import { EmptyBatchError, UnbalancedBatchError } from "./errors";
import type { Money } from "./money";

export type PostingDirection = "debit" | "credit";

export interface PostingLineDraft {
  readonly accountId: string;
  readonly direction: PostingDirection;
  readonly amount: Money;
}

export interface PostingBatchDraft {
  readonly paymentId: string;
  readonly phase: string;
  readonly lines: readonly PostingLineDraft[];
}

export function assertBalanced(batch: PostingBatchDraft): void {
  if (batch.lines.length === 0) {
    throw new EmptyBatchError();
  }

  const totalsByCurrency = new Map<
    string,
    { debits: bigint; credits: bigint }
  >();

  for (const line of batch.lines) {
    const totals = totalsByCurrency.get(line.amount.currency) ?? {
      debits: 0n,
      credits: 0n,
    };
    if (line.direction === "debit") {
      totals.debits += line.amount.minorUnits;
    } else {
      totals.credits += line.amount.minorUnits;
    }
    totalsByCurrency.set(line.amount.currency, totals);
  }

  for (const [currency, totals] of totalsByCurrency) {
    if (totals.debits !== totals.credits) {
      throw new UnbalancedBatchError(currency, totals.debits, totals.credits);
    }
  }
}
