import { ScreenPaymentCommandV1, TOPICS } from "@monorepo/contracts";
import type { EventPublisher } from "@monorepo/domain";
import {
  EVENT_PUBLISHER,
  KAFKA_CLIENT,
  KAFKA_PRODUCER,
  runConsumer,
  startRetryLadder,
} from "@monorepo/kafka-kit";
import { withPaymentContext } from "@monorepo/observability";
import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import type { Consumer, Kafka, Producer } from "kafkajs";
import { screen } from "./rules";

@Injectable()
export class ScreeningConsumer implements OnModuleInit, OnModuleDestroy {
  private consumers: Consumer[] = [];

  constructor(
    @Inject(KAFKA_CLIENT) private readonly kafka: Kafka,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher,
    @Inject(KAFKA_PRODUCER) private readonly producer: Producer,
  ) {}

  async onModuleInit(): Promise<void> {
    const handler = (command: ScreenPaymentCommandV1) =>
      withPaymentContext(command.paymentId, () => this.handle(command));

    const consumer = this.kafka.consumer({ groupId: "risk-screening" });
    await consumer.connect();
    this.consumers.push(consumer);

    void runConsumer({
      consumer,
      topic: TOPICS.riskCommandsV1,
      schema: ScreenPaymentCommandV1,
      retryProducer: this.producer,
      handler,
    });

    this.consumers.push(
      ...(await startRetryLadder({
        kafka: this.kafka,
        producer: this.producer,
        groupId: "risk-screening",
        baseTopic: TOPICS.riskCommandsV1,
        schema: ScreenPaymentCommandV1,
        handler,
      })),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.consumers.map((consumer) => consumer.disconnect()));
  }

  private async handle(command: ScreenPaymentCommandV1): Promise<void> {
    const result = screen({
      sourceAccountId: command.payload.sourceAccountId,
      destinationAccountId: command.payload.destinationAccountId,
      amountMinorUnits: BigInt(command.payload.amount.amountMinorUnits),
      currency: command.payload.amount.currency,
    });

    await this.publisher.publish(TOPICS.riskEventsV1, {
      key: command.paymentId,
      payload: {
        version: 1,
        type: "RiskDecided",
        paymentId: command.paymentId,
        occurredAt: new Date().toISOString(),
        payload: result,
      },
    });
  }
}
