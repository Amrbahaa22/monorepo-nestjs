import { describe, expect, it, jest } from "@jest/globals";
import type { Consumer, EachMessagePayload } from "kafkajs";
import { z } from "zod";
import { runConsumer } from "./consumer-runner";

const schema = z.object({ paymentId: z.string() });

function fakeConsumer(message: { value: Buffer | null; offset: string }) {
  const calls: string[] = [];
  const consumer = {
    subscribe: jest.fn(async () => undefined),
    commitOffsets: jest.fn(async (offsets: unknown) => {
      calls.push(`commit:${JSON.stringify(offsets)}`);
    }),
    run: jest.fn(
      async (config: {
        eachMessage: (p: EachMessagePayload) => Promise<void>;
      }) => {
        await config.eachMessage({
          topic: "payment.events.v1",
          partition: 0,
          message,
        } as unknown as EachMessagePayload);
      },
    ),
  } as unknown as Consumer;

  return { consumer, calls };
}

describe("runConsumer", () => {
  it("commits offset+1 only after the handler resolves", async () => {
    const { consumer, calls } = fakeConsumer({
      value: Buffer.from(JSON.stringify({ paymentId: "pay_1" })),
      offset: "41",
    });

    await runConsumer({
      consumer,
      topic: "payment.events.v1",
      schema,
      handler: async () => {
        calls.push("handler");
      },
    });

    expect(calls).toEqual([
      "handler",
      'commit:[{"topic":"payment.events.v1","partition":0,"offset":"42"}]',
    ]);
  });

  it("does not commit when the handler throws", async () => {
    const { consumer, calls } = fakeConsumer({
      value: Buffer.from(JSON.stringify({ paymentId: "pay_1" })),
      offset: "41",
    });

    await expect(
      runConsumer({
        consumer,
        topic: "payment.events.v1",
        schema,
        handler: async () => {
          throw new Error("transaction rolled back");
        },
      }),
    ).rejects.toThrow("transaction rolled back");

    expect(calls).toEqual([]);
  });

  it("does not commit when the payload fails schema validation", async () => {
    const { consumer, calls } = fakeConsumer({
      value: Buffer.from(JSON.stringify({ wrong: "shape" })),
      offset: "41",
    });

    await expect(
      runConsumer({
        consumer,
        topic: "payment.events.v1",
        schema,
        handler: async () => undefined,
      }),
    ).rejects.toThrow();

    expect(calls).toEqual([]);
  });
});

function fakeRetryProducer(calls: string[]) {
  return {
    send: jest.fn(
      async (args: {
        topic: string;
        messages: { headers?: Record<string, string> }[];
      }) => {
        const headers = args.messages[0].headers ?? {};
        calls.push(`retry:${args.topic}:attempt=${headers["x-retry-attempt"]}`);
        return [];
      },
    ),
  } as unknown as import("kafkajs").Producer;
}

function failingMessage(headers?: Record<string, string>) {
  return {
    value: Buffer.from(JSON.stringify({ paymentId: "pay_1" })),
    offset: "41",
    headers,
  };
}

describe("runConsumer retry escalation", () => {
  it("routes a first failure to .retry.5s and commits past it", async () => {
    const { consumer, calls } = fakeConsumer(failingMessage());

    await runConsumer({
      consumer,
      topic: "payment.events.v1",
      schema,
      retryProducer: fakeRetryProducer(calls),
      handler: async () => {
        throw new Error("handler blew up");
      },
    });

    expect(calls).toEqual([
      "retry:payment.events.v1.retry.5s:attempt=1",
      'commit:[{"topic":"payment.events.v1","partition":0,"offset":"42"}]',
    ]);
  });

  it("escalates using the attempt count carried in headers", async () => {
    const { consumer, calls } = fakeConsumer(
      failingMessage({
        "x-original-topic": "payment.events.v1",
        "x-retry-attempt": "1",
      }),
    );

    await runConsumer({
      consumer,
      topic: "payment.events.v1.retry.5s",
      schema,
      retryProducer: fakeRetryProducer(calls),
      handler: async () => {
        throw new Error("still failing");
      },
    });

    expect(calls[0]).toBe("retry:payment.events.v1.retry.1m:attempt=2");
  });

  it("sends to the dlq once every tier is exhausted", async () => {
    const { consumer, calls } = fakeConsumer(
      failingMessage({
        "x-original-topic": "payment.events.v1",
        "x-retry-attempt": "3",
      }),
    );

    await runConsumer({
      consumer,
      topic: "payment.events.v1.retry.15m",
      schema,
      retryProducer: fakeRetryProducer(calls),
      handler: async () => {
        throw new Error("permanently broken");
      },
    });

    expect(calls[0]).toBe("retry:payment.events.v1.dlq:attempt=4");
  });

  it("routes a schema failure to the retry ladder too", async () => {
    const { consumer, calls } = fakeConsumer({
      value: Buffer.from(JSON.stringify({ wrong: "shape" })),
      offset: "41",
    });

    await runConsumer({
      consumer,
      topic: "payment.events.v1",
      schema,
      retryProducer: fakeRetryProducer(calls),
      handler: async () => undefined,
    });

    expect(calls[0]).toBe("retry:payment.events.v1.retry.5s:attempt=1");
  });
});
