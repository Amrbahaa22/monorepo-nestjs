export const PAYOUT_RAIL = Symbol("PAYOUT_RAIL");

export type RailOutcome =
  | { readonly kind: "settled"; readonly partnerReference: string }
  | { readonly kind: "rejected"; readonly detail: string }
  /** The rail did not answer. The transfer may or may not have happened. */
  | { readonly kind: "ambiguous"; readonly detail: string };

export interface PayoutRail {
  submit(
    partnerReference: string,
    amountMinorUnits: bigint,
    currency: string,
    destinationAccountId: string,
  ): Promise<RailOutcome>;

  /** Asks the partner what actually happened. Never re-sends. */
  lookup(partnerReference: string): Promise<RailOutcome>;
}
