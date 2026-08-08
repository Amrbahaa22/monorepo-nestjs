import type { Consumer, Producer } from "kafkajs";
import type { MessageHandler, ParseableSchema } from "./consumer-runner";
import { buildRetryHeaders, readRetryContext } from "./retry-headers";
import {
  nextRetryTarget,
  type RetryTier,
  remainingDelayMs,
  retryTopicName,
} from "./retry-topics";

export interface RetryConsumerOptions<T> {
  readonly consumer: Consumer;
  readonly producer: Producer;
  readonly baseTopic: string;
  readonly tier: RetryTier;
  readonly schema: ParseableSchema<T>;
  readonly handler: MessageHandler<T>;
}

/**
 * Reads one retry tier. A message that has not aged into its delay pauses the
 * partition and is left uncommitted, so it is redelivered once the pause
 * lifts. Pausing rather than sleeping keeps the consumer heartbeating, which
 * is what stops a 15 minute wait from triggering a group rebalance.
 */
export async function runRetryConsumer<T>(
  options: RetryConsumerOptions<T>,
): Promise<void> {
  const { consumer, producer, baseTopic, tier, schema, handler } = options;
  const topic = retryTopicName(baseTopic, tier);

  await consumer.subscribe({ topic, fromBeginning: true });
  await consumer.run({
    autoCommit: false,
    eachMessage: async (payload) => {
      const { message, partition } = payload;
      if (message.value === null) {
        throw new Error(`Received tombstone on ${topic}`);
      }

      const waitMs = remainingDelayMs(
        tier,
        Number(message.timestamp),
        Date.now(),
      );
      if (waitMs > 0) {
        consumer.pause([{ topic, partitions: [partition] }]);
        setTimeout(
          () => consumer.resume([{ topic, partitions: [partition] }]),
          waitMs,
        ).unref();
        return;
      }

      try {
        await handler(
          schema.parse(JSON.parse(message.value.toString())),
          payload,
        );
      } catch (error) {
        console.error(
          `[kafka-kit] retry handler failed on ${topic}, escalating:`,
          error,
        );
        const context = readRetryContext(message.headers, baseTopic);
        await producer.send({
          topic: nextRetryTarget(context.originalTopic, context.attempt),
          messages: [
            {
              key: message.key,
              value: message.value,
              headers: buildRetryHeaders({
                originalTopic: context.originalTopic,
                attempt: context.attempt + 1,
              }),
            },
          ],
          acks: -1,
        });
      }

      await consumer.commitOffsets([
        { topic, partition, offset: (BigInt(message.offset) + 1n).toString() },
      ]);
    },
  });
}
