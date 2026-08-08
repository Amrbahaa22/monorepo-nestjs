import { describe, expect, it } from "@jest/globals";
import { PaymentInitiatedEventV1 } from "./payment-events";

const valid = {
  version: 1,
  type: "PaymentInitiated",
  paymentId: "pay_1",
  occurredAt: "2026-08-06T10:00:00.000Z",
  payload: {
    sourceAccountId: "acct_source",
    destinationAccountId: "acct_dest",
    amount: { amountMinorUnits: "5000", currency: "USD" },
  },
};

describe("PaymentInitiatedEventV1", () => {
  it("accepts a well-formed event", () => {
    expect(() => PaymentInitiatedEventV1.parse(valid)).not.toThrow();
  });

  it("rejects a version other than 1", () => {
    expect(() =>
      PaymentInitiatedEventV1.parse({ ...valid, version: 2 }),
    ).toThrow();
  });

  it("rejects a non-numeric amountMinorUnits string", () => {
    expect(() =>
      PaymentInitiatedEventV1.parse({
        ...valid,
        payload: {
          ...valid.payload,
          amount: { amountMinorUnits: "12.5", currency: "USD" },
        },
      }),
    ).toThrow();
  });
});
