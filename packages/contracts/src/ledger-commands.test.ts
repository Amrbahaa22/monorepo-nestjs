import { describe, expect, it } from "@jest/globals";
import { PostingCommandV1 } from "./ledger-commands";

const valid = {
  version: 1,
  type: "PostBatch",
  paymentId: "pay_1",
  occurredAt: "2026-08-09T10:00:00.000Z",
  payload: {
    phase: "reserve",
    lines: [
      {
        accountId: "acct_source",
        direction: "debit",
        amount: { amountMinorUnits: "5000", currency: "USD" },
      },
      {
        accountId: "reserve:clearing:USD",
        direction: "credit",
        amount: { amountMinorUnits: "5000", currency: "USD" },
      },
    ],
  },
};

describe("PostingCommandV1", () => {
  it("accepts a two-line batch", () => {
    expect(() => PostingCommandV1.parse(valid)).not.toThrow();
  });

  it("accepts every posting phase", () => {
    for (const phase of ["reserve", "capture", "release", "reverse"]) {
      expect(() =>
        PostingCommandV1.parse({
          ...valid,
          payload: { ...valid.payload, phase },
        }),
      ).not.toThrow();
    }
  });

  it("rejects a single-line batch, which can never balance", () => {
    const bad = {
      ...valid,
      payload: { ...valid.payload, lines: [valid.payload.lines[0]] },
    };
    expect(() => PostingCommandV1.parse(bad)).toThrow();
  });

  it("rejects an unknown direction", () => {
    const bad = {
      ...valid,
      payload: {
        ...valid.payload,
        lines: [
          { ...valid.payload.lines[0], direction: "sideways" },
          valid.payload.lines[1],
        ],
      },
    };
    expect(() => PostingCommandV1.parse(bad)).toThrow();
  });

  it("rejects an unknown phase", () => {
    const bad = { ...valid, payload: { ...valid.payload, phase: "settle" } };
    expect(() => PostingCommandV1.parse(bad)).toThrow();
  });
});
