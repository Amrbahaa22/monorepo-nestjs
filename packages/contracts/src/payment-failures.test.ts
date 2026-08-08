import { describe, expect, it } from "@jest/globals";
import { PaymentFailedEventV1 } from "./payment-failures";

const valid = {
  version: 1,
  type: "PaymentFailed",
  paymentId: "pay_1",
  occurredAt: "2026-08-09T10:00:00.000Z",
  payload: { reason: "risk_declined" },
};

describe("PaymentFailedEventV1", () => {
  it("accepts a known failure reason", () => {
    expect(() => PaymentFailedEventV1.parse(valid)).not.toThrow();
  });

  it("rejects an unknown failure reason", () => {
    const bad = { ...valid, payload: { reason: "vibes" } };
    expect(() => PaymentFailedEventV1.parse(bad)).toThrow();
  });

  it("allows optional detail alongside the reason", () => {
    const withDetail = {
      ...valid,
      payload: { reason: "rail_rejected", detail: "partner returned 402" },
    };
    expect(() => PaymentFailedEventV1.parse(withDetail)).not.toThrow();
  });
});
