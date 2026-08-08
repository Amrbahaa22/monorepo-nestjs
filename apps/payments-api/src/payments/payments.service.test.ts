import { describe, expect, it, jest } from "@jest/globals";
import type { Database } from "../db/client";
import type { IdempotencyService } from "../idempotency/idempotency.service";
import { PaymentsService } from "./payments.service";

const request = {
  sourceAccountId: "acct_source",
  destinationAccountId: "acct_dest",
  amountMinorUnits: "5000",
  currency: "USD",
};

function fakeDb(existingRows: { id: string }[], onTransaction: () => void) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => existingRows }),
      }),
    }),
    transaction: async (fn: (tx: unknown) => Promise<void>) => {
      onTransaction();
      await fn({
        insert: () => ({ values: async () => undefined }),
      });
    },
  } as unknown as Database;
}

describe("PaymentsService.createPayment", () => {
  it("writes intent and outbox in one transaction on first call", async () => {
    const transaction = jest.fn();
    const idempotency = {
      claim: async (_key: string, paymentId: string) => ({
        claimed: true,
        existingPaymentId: paymentId,
      }),
    } as unknown as IdempotencyService;

    const service = new PaymentsService(fakeDb([], transaction), idempotency);
    const result = await service.createPayment("key-1", request);

    expect(result.duplicate).toBe(false);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("returns the original payment id and writes nothing when Redis already holds the key", async () => {
    const transaction = jest.fn();
    const idempotency = {
      claim: async () => ({
        claimed: false,
        existingPaymentId: "pay_original",
      }),
    } as unknown as IdempotencyService;

    const service = new PaymentsService(fakeDb([], transaction), idempotency);
    const result = await service.createPayment("key-1", request);

    expect(result).toEqual({ paymentId: "pay_original", duplicate: true });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("falls back to the database when the Redis claim succeeds but the key was already used", async () => {
    const transaction = jest.fn();
    const idempotency = {
      claim: async (_key: string, paymentId: string) => ({
        claimed: true,
        existingPaymentId: paymentId,
      }),
    } as unknown as IdempotencyService;

    const service = new PaymentsService(
      fakeDb([{ id: "pay_from_db" }], transaction),
      idempotency,
    );
    const result = await service.createPayment("key-1", request);

    expect(result).toEqual({ paymentId: "pay_from_db", duplicate: true });
    expect(transaction).not.toHaveBeenCalled();
  });
});
