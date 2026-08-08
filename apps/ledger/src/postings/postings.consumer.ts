import { PostingCommandV1, TOPICS } from "@monorepo/contracts";
import {
  type EventPublisher,
  Money,
  type PostingBatchDraft,
} from "@monorepo/domain";
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
import { DrizzleLedgerRepository } from "./ledger-repository.drizzle";

@Injectable()
export class PostingsConsumer implements OnModuleInit, OnModuleDestroy {
  private consumers: Consumer[] = [];

  constructor(
    @Inject(KAFKA_CLIENT) private readonly kafka: Kafka,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher,
    @Inject(KAFKA_PRODUCER) private readonly producer: Producer,
    private readonly repository: DrizzleLedgerRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    const handler = (command: PostingCommandV1) =>
      withPaymentContext(command.paymentId, () => this.handlePost(command));

    const main = this.kafka.consumer({ groupId: "ledger" });
    await main.connect();
    this.consumers.push(main);

    void runConsumer({
      consumer: main,
      topic: TOPICS.ledgerCommandsV1,
      schema: PostingCommandV1,
      retryProducer: this.producer,
      handler,
    });

    this.consumers.push(
      ...(await startRetryLadder({
        kafka: this.kafka,
        producer: this.producer,
        groupId: "ledger",
        baseTopic: TOPICS.ledgerCommandsV1,
        schema: PostingCommandV1,
        handler,
      })),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.consumers.map((consumer) => consumer.disconnect()));
  }

  /**
   * Publishes on both the inserted and duplicate paths. A crash after commit
   * but before publish would otherwise strand the payment forever.
   */
  private async handlePost(command: PostingCommandV1): Promise<void> {
    const outcome = await this.repository.post(toDomainBatch(command));

    await this.publisher.publish(TOPICS.ledgerEventsV1, {
      key: command.paymentId,
      payload: {
        version: 1,
        type: "PostingCompleted",
        paymentId: command.paymentId,
        occurredAt: new Date().toISOString(),
        payload: { phase: command.payload.phase, batchId: outcome.batchId },
      },
    });
  }
}

function toDomainBatch(command: PostingCommandV1): PostingBatchDraft {
  return {
    paymentId: command.paymentId,
    phase: command.payload.phase,
    lines: command.payload.lines.map((line) => ({
      accountId: line.accountId,
      direction: line.direction,
      amount: Money.of(
        BigInt(line.amount.amountMinorUnits),
        line.amount.currency,
      ),
    })),
  };
}
