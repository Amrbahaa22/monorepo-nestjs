import {
  PaymentInitiatedEventV1,
  PayoutCompletedEventV1,
  PostingCompletedEventV1,
  RiskDecidedEventV1,
  TOPICS,
} from "@monorepo/contracts";
import {
  KAFKA_CLIENT,
  KAFKA_PRODUCER,
  type ParseableSchema,
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
import { SagaService } from "./saga.service";

@Injectable()
export class SagaConsumer implements OnModuleInit, OnModuleDestroy {
  private consumers: Consumer[] = [];

  constructor(
    @Inject(KAFKA_CLIENT) private readonly kafka: Kafka,
    @Inject(KAFKA_PRODUCER) private readonly producer: Producer,
    private readonly saga: SagaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.subscribe(
      TOPICS.paymentEventsV1,
      PaymentInitiatedEventV1,
      (event: PaymentInitiatedEventV1) =>
        this.saga.handlePaymentInitiated(event),
    );
    await this.subscribe(
      TOPICS.ledgerEventsV1,
      PostingCompletedEventV1,
      (event: PostingCompletedEventV1) =>
        this.saga.handlePostingCompleted(event),
    );
    await this.subscribe(
      TOPICS.riskEventsV1,
      RiskDecidedEventV1,
      (event: RiskDecidedEventV1) => this.saga.handleRiskDecided(event),
    );
    await this.subscribe(
      TOPICS.payoutEventsV1,
      PayoutCompletedEventV1,
      (event: PayoutCompletedEventV1) => this.saga.handlePayoutCompleted(event),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.consumers.map((consumer) => consumer.disconnect()));
  }

  private async subscribe<T extends { paymentId: string }>(
    topic: string,
    schema: ParseableSchema<T>,
    handle: (event: T) => Promise<void>,
  ): Promise<void> {
    const handler = (event: T) =>
      withPaymentContext(event.paymentId, () => handle(event));
    const groupId = `orchestrator.${topic}`;

    const consumer = this.kafka.consumer({ groupId });
    await consumer.connect();
    this.consumers.push(consumer);

    void runConsumer({
      consumer,
      topic,
      schema,
      retryProducer: this.producer,
      handler,
    });

    this.consumers.push(
      ...(await startRetryLadder({
        kafka: this.kafka,
        producer: this.producer,
        groupId,
        baseTopic: topic,
        schema,
        handler,
      })),
    );
  }
}
