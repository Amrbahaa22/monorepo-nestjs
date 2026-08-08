import { describe, expect, it } from "@jest/globals";
import { RULESET_VERSION, screen } from "./rules";

const base = {
  sourceAccountId: "acct_a",
  destinationAccountId: "acct_b",
  amountMinorUnits: 5000n,
  currency: "USD",
};

describe("screen", () => {
  it("approves an ordinary payment", () => {
    expect(screen(base)).toEqual({
      decision: "approved",
      rulesetVersion: RULESET_VERSION,
    });
  });

  it("declines a sanctioned source account", () => {
    const result = screen({ ...base, sourceAccountId: "acct_sanctioned" });
    expect(result.decision).toBe("declined");
    expect(result.reason).toBe("source_account_sanctioned");
  });

  it("declines a sanctioned destination account", () => {
    const result = screen({ ...base, destinationAccountId: "acct_blocked" });
    expect(result.decision).toBe("declined");
    expect(result.reason).toBe("destination_account_sanctioned");
  });

  it("declines above the auto-approval threshold", () => {
    const result = screen({ ...base, amountMinorUnits: 1_000_000_01n });
    expect(result.decision).toBe("declined");
    expect(result.reason).toBe("above_auto_approval_threshold");
  });

  it("approves exactly at the threshold", () => {
    expect(screen({ ...base, amountMinorUnits: 1_000_000_00n }).decision).toBe(
      "approved",
    );
  });

  it("stamps every decision with the ruleset that produced it", () => {
    expect(screen(base).rulesetVersion).toBe(RULESET_VERSION);
    expect(
      screen({ ...base, sourceAccountId: "acct_sanctioned" }).rulesetVersion,
    ).toBe(RULESET_VERSION);
  });
});
