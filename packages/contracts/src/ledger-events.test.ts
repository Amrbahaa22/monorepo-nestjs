import { describe, expect, it } from "@jest/globals";
import {
  PostingCompletedEventV1,
  PostingReservedEventV1,
} from "./ledger-events";

const valid = {
  version: 1,
  type: "PostingReserved",
  paymentId: "pay_1",
  occurredAt: "2026-08-06T10:00:00.000Z",
  payload: {
    phase: "reserve",
    batchId: "3f1a9c2e-9b3d-4a1e-8c5b-7d2f4e6a1b90",
  },
};

describe("PostingReservedEventV1", () => {
  it("accepts a well-formed event", () => {
    expect(() => PostingReservedEventV1.parse(valid)).not.toThrow();
  });

  it("rejects a non-uuid batchId", () => {
    const bad = {
      ...valid,
      payload: { ...valid.payload, batchId: "not-a-uuid" },
    };
    expect(() => PostingReservedEventV1.parse(bad)).toThrow();
  });
});

describe("PostingCompletedEventV1", () => {
  const base = {
    version: 1,
    type: "PostingCompleted",
    paymentId: "pay_1",
    occurredAt: "2026-08-09T10:00:00.000Z",
    payload: {
      phase: "capture",
      batchId: "3f1a9c2e-9b3d-4a1e-8c5b-7d2f4e6a1b90",
    },
  };

  it("accepts every posting phase", () => {
    for (const phase of ["reserve", "capture", "release", "reverse"]) {
      expect(() =>
        PostingCompletedEventV1.parse({
          ...base,
          payload: { ...base.payload, phase },
        }),
      ).not.toThrow();
    }
  });

  it("rejects an unknown phase", () => {
    expect(() =>
      PostingCompletedEventV1.parse({
        ...base,
        payload: { ...base.payload, phase: "settle" },
      }),
    ).toThrow();
  });
});
