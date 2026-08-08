import { describe, expect, it } from "@jest/globals";
import { EmptyBatchError, UnbalancedBatchError } from "./errors";
import { Money } from "./money";
import { assertBalanced, type PostingBatchDraft } from "./posting-batch";

function batch(lines: PostingBatchDraft["lines"]): PostingBatchDraft {
  return { paymentId: "pay_1", phase: "reserve", lines };
}

describe("assertBalanced", () => {
  it("accepts a batch where debits equal credits", () => {
    const b = batch([
      { accountId: "a", direction: "debit", amount: Money.of(1000n, "USD") },
      { accountId: "b", direction: "credit", amount: Money.of(1000n, "USD") },
    ]);
    expect(() => assertBalanced(b)).not.toThrow();
  });

  it("rejects a batch where debits and credits differ", () => {
    const b = batch([
      { accountId: "a", direction: "debit", amount: Money.of(1000n, "USD") },
      { accountId: "b", direction: "credit", amount: Money.of(900n, "USD") },
    ]);
    expect(() => assertBalanced(b)).toThrow(UnbalancedBatchError);
  });

  it("rejects an empty batch", () => {
    expect(() => assertBalanced(batch([]))).toThrow(EmptyBatchError);
  });

  it("balances independently per currency", () => {
    const b = batch([
      { accountId: "a", direction: "debit", amount: Money.of(1000n, "USD") },
      { accountId: "b", direction: "credit", amount: Money.of(1000n, "USD") },
      { accountId: "c", direction: "debit", amount: Money.of(500n, "EUR") },
      { accountId: "d", direction: "credit", amount: Money.of(500n, "EUR") },
    ]);
    expect(() => assertBalanced(b)).not.toThrow();
  });

  it("rejects when one currency group is unbalanced even if totals net out", () => {
    const b = batch([
      { accountId: "a", direction: "debit", amount: Money.of(1000n, "USD") },
      { accountId: "b", direction: "credit", amount: Money.of(900n, "USD") },
      { accountId: "c", direction: "debit", amount: Money.of(400n, "EUR") },
      { accountId: "d", direction: "credit", amount: Money.of(500n, "EUR") },
    ]);
    expect(() => assertBalanced(b)).toThrow(UnbalancedBatchError);
  });
});
