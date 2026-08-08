import { Money } from "./money";
import type { PostingBatchDraft, PostingLineDraft } from "./posting-batch";

export type SagaState =
  | "STARTED"
  | "RESERVING"
  | "SCREENING"
  | "CAPTURING"
  | "PAYING_OUT"
  | "COMPLETED"
  | "COMPENSATING"
  | "FAILED";

export type PostingPhase = "reserve" | "capture" | "release" | "reverse";

export interface PaymentDetails {
  readonly paymentId: string;
  readonly sourceAccountId: string;
  readonly destinationAccountId: string;
  readonly amountMinorUnits: bigint;
  readonly currency: string;
}

export interface PaymentInitiated {
  readonly type: "PaymentInitiated";
}

export interface PostingCompleted {
  readonly type: "PostingCompleted";
  readonly phase: PostingPhase;
}

export interface RiskDecided {
  readonly type: "RiskDecided";
  readonly decision: "approved" | "declined";
}

export interface PayoutCompleted {
  readonly type: "PayoutCompleted";
  readonly outcome: "settled" | "rejected";
}

export type SagaEvent =
  | PaymentInitiated
  | PostingCompleted
  | RiskDecided
  | PayoutCompleted;

export type SagaAction =
  | { readonly kind: "post"; readonly batch: PostingBatchDraft }
  | { readonly kind: "screen" }
  | { readonly kind: "payout" }
  | { readonly kind: "none" };

export interface SagaDecision {
  readonly action: SagaAction;
  readonly nextState: SagaState;
}

const NOTHING: SagaAction = { kind: "none" };

// ponytail: one global clearing account per phase per currency. A real
// chart-of-accounts is a later concern; callers only ever see account ids.
function clearingAccountId(phase: PostingPhase, currency: string): string {
  return `${phase}:clearing:${currency}`;
}

function postingLines(
  details: PaymentDetails,
  phase: PostingPhase,
): PostingLineDraft[] {
  const amount = Money.of(details.amountMinorUnits, details.currency);

  if (phase === "reserve") {
    return [
      { accountId: details.sourceAccountId, direction: "debit", amount },
      {
        accountId: clearingAccountId("reserve", details.currency),
        direction: "credit",
        amount,
      },
    ];
  }

  if (phase === "capture") {
    return [
      {
        accountId: clearingAccountId("reserve", details.currency),
        direction: "debit",
        amount,
      },
      {
        accountId: details.destinationAccountId,
        direction: "credit",
        amount,
      },
    ];
  }

  // release and reverse are compensations: the same lines, mirrored.
  const compensated = phase === "release" ? "reserve" : "capture";
  return postingLines(details, compensated).map((line) => ({
    accountId: line.accountId,
    direction: line.direction === "debit" ? "credit" : "debit",
    amount: line.amount,
  }));
}

export function postingBatch(
  details: PaymentDetails,
  phase: PostingPhase,
): PostingBatchDraft {
  return {
    paymentId: details.paymentId,
    phase,
    lines: postingLines(details, phase),
  };
}

function post(details: PaymentDetails, phase: PostingPhase): SagaAction {
  return { kind: "post", batch: postingBatch(details, phase) };
}

/**
 * The whole payment flow in one function. Every transition is guarded by the
 * current state, so a duplicate delivery of an event the saga has already
 * acted on returns `none` and changes nothing.
 */
export function decide(
  state: SagaState,
  details: PaymentDetails,
  event: SagaEvent,
): SagaDecision {
  switch (event.type) {
    case "PaymentInitiated":
      return state === "STARTED"
        ? { action: post(details, "reserve"), nextState: "RESERVING" }
        : { action: NOTHING, nextState: state };

    case "PostingCompleted":
      return decidePostingCompleted(state, details, event);

    case "RiskDecided":
      if (state !== "SCREENING") {
        return { action: NOTHING, nextState: state };
      }
      return event.decision === "approved"
        ? { action: post(details, "capture"), nextState: "CAPTURING" }
        : { action: post(details, "release"), nextState: "COMPENSATING" };

    case "PayoutCompleted":
      if (state !== "PAYING_OUT") {
        return { action: NOTHING, nextState: state };
      }
      return event.outcome === "settled"
        ? { action: NOTHING, nextState: "COMPLETED" }
        : { action: post(details, "reverse"), nextState: "COMPENSATING" };
  }
}

function decidePostingCompleted(
  state: SagaState,
  details: PaymentDetails,
  event: PostingCompleted,
): SagaDecision {
  if (event.phase === "reserve" && state === "RESERVING") {
    return { action: { kind: "screen" }, nextState: "SCREENING" };
  }
  if (event.phase === "capture" && state === "CAPTURING") {
    return { action: { kind: "payout" }, nextState: "PAYING_OUT" };
  }
  if (
    (event.phase === "release" || event.phase === "reverse") &&
    state === "COMPENSATING"
  ) {
    return { action: NOTHING, nextState: "FAILED" };
  }
  return { action: NOTHING, nextState: state };
}
