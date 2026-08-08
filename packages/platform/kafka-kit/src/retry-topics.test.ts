import { describe, expect, it } from "@jest/globals";
import {
  dlqTopicName,
  ladderTopicNames,
  nextRetryTarget,
  retryTopicName,
} from "./retry-topics";

describe("retry topic naming", () => {
  it("builds a tier topic name", () => {
    expect(retryTopicName("ledger.commands.v1", "5s")).toBe(
      "ledger.commands.v1.retry.5s",
    );
  });

  it("builds a dlq topic name", () => {
    expect(dlqTopicName("ledger.commands.v1")).toBe("ledger.commands.v1.dlq");
  });

  it("escalates through every tier then to the dlq", () => {
    const base = "ledger.commands.v1";
    expect(nextRetryTarget(base, 0)).toBe("ledger.commands.v1.retry.5s");
    expect(nextRetryTarget(base, 1)).toBe("ledger.commands.v1.retry.1m");
    expect(nextRetryTarget(base, 2)).toBe("ledger.commands.v1.retry.15m");
    expect(nextRetryTarget(base, 3)).toBe("ledger.commands.v1.dlq");
    expect(nextRetryTarget(base, 99)).toBe("ledger.commands.v1.dlq");
  });

  it("rejects a negative attempt count", () => {
    expect(() => nextRetryTarget("ledger.commands.v1", -1)).toThrow();
  });
});

describe("ladderTopicNames", () => {
  it("lists the base topic, every tier, and the dlq", () => {
    expect(ladderTopicNames("payment.events.v1")).toEqual([
      "payment.events.v1",
      "payment.events.v1.retry.5s",
      "payment.events.v1.retry.1m",
      "payment.events.v1.retry.15m",
      "payment.events.v1.dlq",
    ]);
  });
});
