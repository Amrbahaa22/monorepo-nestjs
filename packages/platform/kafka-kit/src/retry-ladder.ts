import type { Consumer, Kafka, Producer } from "kafkajs";
import type { MessageHandler, ParseableSchema } from "./consumer-runner";
import { runRetryConsumer } from "./retry-consumer";
import { RETRY_TIERS } from "./retry-topics";

export interface RetryLadderOptions<T> {
  readonly kafka: Kafka;
  readonly producer: Producer;
  readonly groupId: string;
  readonly baseTopic: string;
  readonly schema: ParseableSchema<T>;
  readonly handler: MessageHandler<T>;
}

/**
 * One consumer per tier, each in its own group so a slow 15m tier never
 * blocks the 5s tier. Returns the consumers so the caller can disconnect
 * them on shutdown.
 */
export async function startRetryLadder<T>(
  options: RetryLadderOptions<T>,
): Promise<Consumer[]> {
  const consumers: Consumer[] = [];

  for (const tier of RETRY_TIERS) {
    const consumer = options.kafka.consumer({
      groupId: `${options.groupId}.retry.${tier}`,
    });
    await consumer.connect();
    void runRetryConsumer({
      consumer,
      producer: options.producer,
      baseTopic: options.baseTopic,
      tier,
      schema: options.schema,
      handler: options.handler,
    });
    consumers.push(consumer);
  }

  return consumers;
}
