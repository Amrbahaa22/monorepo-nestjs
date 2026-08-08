export const RULESET_VERSION = "2026.08.1";

export interface ScreeningInput {
  readonly sourceAccountId: string;
  readonly destinationAccountId: string;
  readonly amountMinorUnits: bigint;
  readonly currency: string;
}

export interface ScreeningResult {
  readonly decision: "approved" | "declined";
  readonly rulesetVersion: string;
  readonly reason?: string;
}

// ponytail: static deny list stands in for a sanctions provider. Swap the
// lookup for a real feed; the decision shape does not change.
const DENIED_ACCOUNTS = new Set(["acct_sanctioned", "acct_blocked"]);

const REVIEW_THRESHOLD_MINOR_UNITS = 1_000_000_00n;

/**
 * A screening hit is a business outcome, not an error: it returns a decision
 * the orchestrator routes through the saga, never an exception that would
 * send the message to the DLQ.
 */
export function screen(input: ScreeningInput): ScreeningResult {
  if (DENIED_ACCOUNTS.has(input.sourceAccountId)) {
    return {
      decision: "declined",
      rulesetVersion: RULESET_VERSION,
      reason: "source_account_sanctioned",
    };
  }

  if (DENIED_ACCOUNTS.has(input.destinationAccountId)) {
    return {
      decision: "declined",
      rulesetVersion: RULESET_VERSION,
      reason: "destination_account_sanctioned",
    };
  }

  if (input.amountMinorUnits > REVIEW_THRESHOLD_MINOR_UNITS) {
    return {
      decision: "declined",
      rulesetVersion: RULESET_VERSION,
      reason: "above_auto_approval_threshold",
    };
  }

  return { decision: "approved", rulesetVersion: RULESET_VERSION };
}
