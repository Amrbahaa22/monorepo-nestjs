import { TOPICS } from "@monorepo/contracts";
import type { Money, PaymentDetails, SagaAction } from "@monorepo/domain";

export interface WireCommand {
  readonly topic: string;
  readonly payload: Record<string, unknown>;
}

function money(amount: Money): { amountMinorUnits: string; currency: string } {
  return {
    amountMinorUnits: amount.minorUnits.toString(),
    currency: amount.currency,
  };
}

function meta(paymentId: string, type: string) {
  return {
    version: 1,
    type,
    paymentId,
    occurredAt: new Date().toISOString(),
  };
}

/** Maps a domain action onto the topic and wire shape that carry it. */
export function toWireCommand(
  details: PaymentDetails,
  action: Exclude<SagaAction, { kind: "none" }>,
): WireCommand {
  if (action.kind === "post") {
    return {
      topic: TOPICS.ledgerCommandsV1,
      payload: {
        ...meta(details.paymentId, "PostBatch"),
        payload: {
          phase: action.batch.phase,
          lines: action.batch.lines.map((line) => ({
            accountId: line.accountId,
            direction: line.direction,
            amount: money(line.amount),
          })),
        },
      },
    };
  }

  if (action.kind === "screen") {
    return {
      topic: TOPICS.riskCommandsV1,
      payload: {
        ...meta(details.paymentId, "ScreenPayment"),
        payload: {
          sourceAccountId: details.sourceAccountId,
          destinationAccountId: details.destinationAccountId,
          amount: {
            amountMinorUnits: details.amountMinorUnits.toString(),
            currency: details.currency,
          },
        },
      },
    };
  }

  return {
    topic: TOPICS.payoutCommandsV1,
    payload: {
      ...meta(details.paymentId, "SubmitPayout"),
      payload: {
        destinationAccountId: details.destinationAccountId,
        amount: {
          amountMinorUnits: details.amountMinorUnits.toString(),
          currency: details.currency,
        },
        // Derived from paymentId so a reconcile poll can identify the transfer
        // without guessing.
        partnerReference: `pmt-${details.paymentId}`,
      },
    },
  };
}
