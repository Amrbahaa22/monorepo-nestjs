import { describe, expect, it } from "@jest/globals";
import {
  Money,
  type PostingBatchDraft,
  UnbalancedBatchError,
} from "@monorepo/domain";
import type { Database } from "../db/client";
import { DrizzleLedgerRepository } from "./ledger-repository.drizzle";

function batch(creditMinorUnits: bigint, phase = "reserve"): PostingBatchDraft {
  return {
    paymentId: "3f1a9c2e-9b3d-4a1e-8c5b-7d2f4e6a1b90",
    phase,
    lines: [
      {
        accountId: "acct_source",
        direction: "debit",
        amount: Money.of(5000n, "USD"),
      },
      {
        accountId: "reserve:clearing:USD",
        direction: "credit",
        amount: Money.of(creditMinorUnits, "USD"),
      },
    ],
  };
}

function fakeDb(batchInserted: boolean, calls: string[]) {
  const tx = {
    insert: () => ({
      values: (values: unknown) => {
        // The batch row is a single object; journal lines arrive as an array.
        calls.push(
          Array.isArray(values)
            ? `insert:lines:${values.length}`
            : "insert:batch",
        );
        // Drizzle builders are awaitable AND chainable, so the fake is a real
        // promise carrying the builder methods rather than a hand-made thenable.
        return Object.assign(Promise.resolve(undefined), {
          onConflictDoNothing: () => ({
            returning: async () => (batchInserted ? [{ id: "batch-new" }] : []),
          }),
        });
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            calls.push("select:existing");
            return [{ id: "batch-existing" }];
          },
        }),
      }),
    }),
  };

  return {
    transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
  } as unknown as Database;
}

describe("DrizzleLedgerRepository.post", () => {
  it("inserts the batch then its journal lines", async () => {
    const calls: string[] = [];
    const repository = new DrizzleLedgerRepository(fakeDb(true, calls));

    const outcome = await repository.post(batch(5000n));

    expect(outcome.result).toBe("inserted");
    expect(outcome.batchId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(calls).toEqual(["insert:batch", "insert:lines:2"]);
  });

  it("writes no journal lines when the batch already exists", async () => {
    const calls: string[] = [];
    const repository = new DrizzleLedgerRepository(fakeDb(false, calls));

    const outcome = await repository.post(batch(5000n));

    expect(outcome.result).toBe("duplicate");
    expect(calls).toEqual(["insert:batch", "select:existing"]);
  });

  it("returns the existing batch id on a duplicate, not a fresh one", async () => {
    const repository = new DrizzleLedgerRepository(fakeDb(false, []));
    const outcome = await repository.post(batch(5000n));
    expect(outcome.batchId).toBe("batch-existing");
  });

  it("refuses an unbalanced batch before opening a transaction", async () => {
    const calls: string[] = [];
    const repository = new DrizzleLedgerRepository(fakeDb(true, calls));

    await expect(repository.post(batch(4000n))).rejects.toThrow(
      UnbalancedBatchError,
    );
    expect(calls).toEqual([]);
  });

  it("accepts any posting phase, not only reserve", async () => {
    for (const phase of ["capture", "release", "reverse"]) {
      const repository = new DrizzleLedgerRepository(fakeDb(true, []));
      const outcome = await repository.post(batch(5000n, phase));
      expect(outcome.result).toBe("inserted");
    }
  });
});
