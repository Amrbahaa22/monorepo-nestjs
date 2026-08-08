import { Injectable } from "@nestjs/common";
import type { PayoutRail, RailOutcome } from "./rail";

// ponytail: in-memory stand-in for a real rail client. Settles everything it
// is given and remembers it, so lookup can answer truthfully. Replace with an
// HTTP client; nothing outside this file changes.
@Injectable()
export class StaticPayoutRail implements PayoutRail {
  private readonly submitted = new Map<string, RailOutcome>();

  async submit(
    partnerReference: string,
    _amountMinorUnits: bigint,
    _currency: string,
    destinationAccountId: string,
  ): Promise<RailOutcome> {
    const outcome: RailOutcome =
      destinationAccountId === "acct_rail_reject"
        ? { kind: "rejected", detail: "partner returned 402" }
        : { kind: "settled", partnerReference };

    this.submitted.set(partnerReference, outcome);
    return outcome;
  }

  async lookup(partnerReference: string): Promise<RailOutcome> {
    return (
      this.submitted.get(partnerReference) ?? {
        kind: "ambiguous",
        detail: "partner has no record yet",
      }
    );
  }
}
