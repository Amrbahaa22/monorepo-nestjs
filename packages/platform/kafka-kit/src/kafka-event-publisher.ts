import type { EventEnvelope, EventPublisher } from "@monorepo/domain";
import type { Producer } from "kafkajs";

export class KafkaEventPublisher implements EventPublisher {
  constructor(private readonly producer: Producer) {}

  async publish(topic: string, envelope: EventEnvelope): Promise<void> {
    await this.producer.send({
      topic,
      messages: [
        { key: envelope.key, value: JSON.stringify(envelope.payload) },
      ],
      acks: -1,
    });
  }
}
