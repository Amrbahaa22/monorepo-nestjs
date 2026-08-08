import type { Consumer, EachMessagePayload, Producer } from "kafkajs";
import { buildRetryHeaders, readRetryContext } from "./retry-headers";
import { nextRetryTarget } from "./retry-topics";

export type MessageHandler<T> = (
  message: T,
  raw: EachMessagePayload,
) => Promise<void>;

export interface ParseableSchema<T> {
  parse(data: unknown): T;
}

export interface ConsumerRunnerOptions<T> {
  readonly consumer: Consumer;
  readonly topic: string;
  readonly schema: ParseableSchema<T>;
  readonly handler: MessageHandler<T>;
  /**
   * Supply to route handler failures onto the retry ladder instead of letting
   * KafkaJS redeliver the same message forever. Without it, a poison message
   * blocks its partition.
   */
  readonly retryProducer?: Producer;
}

export async function runConsumer<T>(
  options: ConsumerRunnerOptions<T>,
): Promise<void> {
  const { consumer, topic, schema, handler, retryProducer } = options;

  await consumer.subscribe({ topic, fromBeginning: true });
  await consumer.run({
    autoCommit: false,
    eachMessage: async (payload) => {
      const { message, partition } = payload;
      if (message.value === null) {
        throw new Error(
          `Received tombstone on ${topic} at offset ${message.offset}`,
        );
      }

      const value = message.value;

      try {
        const decoded = schema.parse(JSON.parse(value.toString()));
        await handler(decoded, payload);
      } catch (error) {
        if (retryProducer === undefined) {
          throw error;
        }
        // Escalating without a trace would make every handler bug look like
        // a silent no-op, so the cause is always reported before rerouting.
        console.error(
          `[kafka-kit] handler failed on ${topic}, routing to retry ladder:`,
          error,
        );
        await escalate({ producer: retryProducer, topic, payload, value });
      }

      await consumer.commitOffsets([
        { topic, partition, offset: (BigInt(message.offset) + 1n).toString() },
      ]);
    },
  });
}

async function escalate(args: {
  producer: Producer;
  topic: string;
  payload: EachMessagePayload;
  value: Buffer;
}): Promise<void> {
  const { producer, topic, payload, value } = args;
  const context = readRetryContext(payload.message.headers, topic);
  const target = nextRetryTarget(context.originalTopic, context.attempt);

  await producer.send({
    topic: target,
    messages: [
      {
        key: payload.message.key,
        value,
        headers: buildRetryHeaders({
          originalTopic: context.originalTopic,
          attempt: context.attempt + 1,
        }),
      },
    ],
    acks: -1,
  });
}
