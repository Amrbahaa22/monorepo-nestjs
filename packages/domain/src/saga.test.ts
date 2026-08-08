import { describe, expect, it } from "@jest/globals";
import { assertBalanced } from "./posting-batch";
import {
  decide,
  type PaymentDetails,
  postingBatch,
  type SagaState,
} from "./saga";

const details: PaymentDetails = {
  paymentId: "3f1a9c2e-9b3d-4a1e-8c5b-7d2f4e6a1b90",
  sourceAccountId: "acct_source",
  destinationAccountId: "acct_dest",
  amountMinorUnits: 5000n,
  currency: "USD",
};

describe("decide - happy path", () => {
  it("STARTED + PaymentInitiated posts the reserve batch", () => {
    const decision = decide("STARTED", details, { type: "PaymentInitiated" });
    expect(decision.nextState).toBe("RESERVING");
    expect(decision.action).toMatchObject({ kind: "post" });
  });

  it("RESERVING + reserve posted asks for screening", () => {
    const decision = decide("RESERVING", details, {
      type: "PostingCompleted",
      phase: "reserve",
    });
    expect(decision).toMatchObject({
      action: { kind: "screen" },
      nextState: "SCREENING",
    });
  });

  it("SCREENING + approved posts the capture batch", () => {
    const decision = decide("SCREENING", details, {
      type: "RiskDecided",
      decision: "approved",
    });
    expect(decision.nextState).toBe("CAPTURING");
    expect(decision.action).toMatchObject({ kind: "post" });
  });

  it("CAPTURING + capture posted asks for payout", () => {
    const decision = decide("CAPTURING", details, {
      type: "PostingCompleted",
      phase: "capture",
    });
    expect(decision).toMatchObject({
      action: { kind: "payout" },
      nextState: "PAYING_OUT",
    });
  });

  it("PAYING_OUT + settled completes the saga", () => {
    const decision = decide("PAYING_OUT", details, {
      type: "PayoutCompleted",
      outcome: "settled",
    });
    expect(decision).toMatchObject({
      action: { kind: "none" },
      nextState: "COMPLETED",
    });
  });
});

describe("decide - compensation", () => {
  it("a risk decline releases the reservation instead of failing outright", () => {
    const decision = decide("SCREENING", details, {
      type: "RiskDecided",
      decision: "declined",
    });
    expect(decision.nextState).toBe("COMPENSATING");
    expect(decision.action).toMatchObject({ kind: "post" });
  });

  it("a rejected payout reverses the capture", () => {
    const decision = decide("PAYING_OUT", details, {
      type: "PayoutCompleted",
      outcome: "rejected",
    });
    expect(decision.nextState).toBe("COMPENSATING");
  });

  it("a completed compensation ends in FAILED", () => {
    for (const phase of ["release", "reverse"] as const) {
      const decision = decide("COMPENSATING", details, {
        type: "PostingCompleted",
        phase,
      });
      expect(decision.nextState).toBe("FAILED");
    }
  });
});

describe("decide - duplicate deliveries", () => {
  it("ignores an event the saga has already acted on", () => {
    const states: SagaState[] = ["SCREENING", "CAPTURING", "COMPLETED"];
    for (const state of states) {
      const decision = decide(state, details, { type: "PaymentInitiated" });
      expect(decision).toMatchObject({
        action: { kind: "none" },
        nextState: state,
      });
    }
  });

  it("ignores a risk decision arriving outside SCREENING", () => {
    const decision = decide("CAPTURING", details, {
      type: "RiskDecided",
      decision: "approved",
    });
    expect(decision).toMatchObject({
      action: { kind: "none" },
      nextState: "CAPTURING",
    });
  });

  it("ignores a posting completion for the wrong phase", () => {
    const decision = decide("RESERVING", details, {
      type: "PostingCompleted",
      phase: "capture",
    });
    expect(decision.nextState).toBe("RESERVING");
  });
});

describe("postingBatch", () => {
  it("produces a balanced batch for every phase", () => {
    for (const phase of ["reserve", "capture", "release", "reverse"] as const) {
      expect(() => assertBalanced(postingBatch(details, phase))).not.toThrow();
    }
  });

  it("reserve debits the source and credits reserve clearing", () => {
    const batch = postingBatch(details, "reserve");
    expect(batch.lines[0]).toMatchObject({
      accountId: "acct_source",
      direction: "debit",
    });
    expect(batch.lines[1]).toMatchObject({
      accountId: "reserve:clearing:USD",
      direction: "credit",
    });
  });

  it("capture moves the money out of clearing to the destination", () => {
    const batch = postingBatch(details, "capture");
    expect(batch.lines[0]).toMatchObject({
      accountId: "reserve:clearing:USD",
      direction: "debit",
    });
    expect(batch.lines[1]).toMatchObject({
      accountId: "acct_dest",
      direction: "credit",
    });
  });

  it("release exactly mirrors reserve", () => {
    const reserve = postingBatch(details, "reserve");
    const release = postingBatch(details, "release");

    expect(release.lines).toHaveLength(reserve.lines.length);
    release.lines.forEach((line, index) => {
      expect(line.accountId).toBe(reserve.lines[index].accountId);
      expect(line.direction).not.toBe(reserve.lines[index].direction);
      expect(line.amount.equals(reserve.lines[index].amount)).toBe(true);
    });
  });

  it("reverse exactly mirrors capture", () => {
    const capture = postingBatch(details, "capture");
    const reverse = postingBatch(details, "reverse");

    reverse.lines.forEach((line, index) => {
      expect(line.accountId).toBe(capture.lines[index].accountId);
      expect(line.direction).not.toBe(capture.lines[index].direction);
    });
  });
});
