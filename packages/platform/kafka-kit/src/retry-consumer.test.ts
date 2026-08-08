import { describe, expect, it, jest } from "@jest/globals";
import type { Consumer, EachMessagePayload, Producer } from "kafkajs";
import { z } from "zod";
import { runRetryConsumer } from "./retry-consumer";
import { remainingDelayMs } from "./retry-topics";

const schema = z.object({ paymentId: z.string() });

function fakeConsumer(message: {
  value: Buffer;
  offset: string;
  timestamp: string;
  headers?: Record<string, string>;
}) {
  const calls: string[] = [];
  const consumer = {
    subscribe: jest.fn(async () => undefined),
    pause: jest.fn((args: { topic: string }[]) => {
      calls.push(`pause:${args[0].topic}`);
    }),
    resume: jest.fn(() => undefined),
    commitOffsets: jest.fn(async () => {
      calls.push("commit");
    }),
    run: jest.fn(
      async (config: {
        eachMessage: (p: EachMessagePayload) => Promise<void>;
      }) => {
        await config.eachMessage({
          topic: "payment.events.v1.retry.5s",
          partition: 0,
          message,
        } as unknown as EachMessagePayload);
      },
    ),
  } as unknown as Consumer;

  return { consumer, calls };
}

function fakeProducer(calls: string[]) {
  return {
    send: jest.fn(async (args: { topic: string }) => {
      calls.push(`escalate:${args.topic}`);
      return [];
    }),
  } as unknown as Producer;
}

const value = Buffer.from(JSON.stringify({ paymentId: "pay_1" }));

describe("remainingDelayMs", () => {
  it("reports the wait still owed", () => {
    expect(remainingDelayMs("5s", 1_000_000, 1_002_000)).toBe(3_000);
  });

  it("reports zero once the delay has elapsed", () => {
    expect(remainingDelayMs("5s", 1_000_000, 1_009_000)).toBe(0);
  });

  it("scales with the tier", () => {
    expect(remainingDelayMs("15m", 0, 0)).toBe(900_000);
  });
});

describe("runRetryConsumer", () => {
  it("pauses the partition and does not commit a message still inside its delay", async () => {
    const { consumer, calls } = fakeConsumer({
      value,
      offset: "10",
      timestamp: String(Date.now()),
    });

    await runRetryConsumer({
      consumer,
      producer: fakeProducer(calls),
      baseTopic: "payment.events.v1",
      tier: "5s",
      schema,
      handler: async () => {
        calls.push("handler");
      },
    });

    expect(calls).toEqual(["pause:payment.events.v1.retry.5s"]);
  });

  it("runs the handler and commits once the delay has elapsed", async () => {
    const { consumer, calls } = fakeConsumer({
      value,
      offset: "10",
      timestamp: String(Date.now() - 10_000),
    });

    await runRetryConsumer({
      consumer,
      producer: fakeProducer(calls),
      baseTopic: "payment.events.v1",
      tier: "5s",
      schema,
      handler: async () => {
        calls.push("handler");
      },
    });

    expect(calls).toEqual(["handler", "commit"]);
  });

  it("escalates to the next tier when the retried handler fails again", async () => {
    const { consumer, calls } = fakeConsumer({
      value,
      offset: "10",
      timestamp: String(Date.now() - 10_000),
      headers: {
        "x-original-topic": "payment.events.v1",
        "x-retry-attempt": "1",
      },
    });

    await runRetryConsumer({
      consumer,
      producer: fakeProducer(calls),
      baseTopic: "payment.events.v1",
      tier: "5s",
      schema,
      handler: async () => {
        throw new Error("still broken");
      },
    });

    expect(calls).toEqual(["escalate:payment.events.v1.retry.1m", "commit"]);
  });
});
