import { describe, expect, it } from "@jest/globals";
import { MAX_RECONCILE_ATTEMPTS, nextReconcileStep } from "./reconcile-policy";

describe("nextReconcileStep", () => {
  it("resolves immediately on a terminal settled status", () => {
    expect(nextReconcileStep("settled", 0)).toEqual({
      kind: "resolve",
      outcome: "settled",
    });
  });

  it("resolves immediately on a terminal rejected status", () => {
    expect(nextReconcileStep("rejected", 3)).toEqual({
      kind: "resolve",
      outcome: "rejected",
    });
  });

  it("polls again on an ambiguous result rather than re-sending", () => {
    expect(nextReconcileStep("ambiguous", 0)).toEqual({
      kind: "poll-again",
      attempt: 1,
    });
  });

  it("never reports failure for an ambiguous result", () => {
    for (let attempt = 0; attempt < MAX_RECONCILE_ATTEMPTS; attempt++) {
      const step = nextReconcileStep("ambiguous", attempt);
      expect(step.kind).not.toBe("resolve");
    }
  });

  it("escalates to an operator once polling is exhausted", () => {
    expect(nextReconcileStep("ambiguous", MAX_RECONCILE_ATTEMPTS - 1)).toEqual({
      kind: "escalate-to-operator",
    });
  });
});
