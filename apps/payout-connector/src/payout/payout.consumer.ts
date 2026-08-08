import {
  ReconcilePayoutCommandV1,
  SubmitPayoutCommandV1,
  TOPICS,
} from "@monorepo/contracts";
import type { EventPublisher } from "@monorepo/domain";
import {
  EVENT_PUBLISHER,
  KAFKA_CLIENT,
  KAFKA_PRODUCER,
  type ParseableSchema,
  runConsumer,
} from "@monorepo/kafka-kit";
import { withPaymentContext } from "@monorepo/observability";
import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import type { Consumer, Kafka, Producer } from "kafkajs";
import { PAYOUT_RAIL, type PayoutRail } from "./rail";
import { nextReconcileStep } from "./reconcile-policy";

@Injectable()
export class PayoutConsumer implements OnModuleInit, OnModuleDestroy {
  private consumers: Consumer[] = [];

  constructor(
    @Inject(KAFKA_CLIENT) private readonly kafka: Kafka,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher,
    @Inject(KAFKA_PRODUCER) private readonly producer: Producer,
    @Inject(PAYOUT_RAIL) private readonly rail: PayoutRail,
  ) {}

  /**
   * No retry ladder here, deliberately. Blind redelivery of a submit command
   * could send the same transfer twice; ambiguity goes to payout.reconcile
   * instead, where it is polled rather than re-sent.
   */
  async onModuleInit(): Promise<void> {
    await this.consume(
      TOPICS.payoutCommandsV1,
      "payout-connector",
      SubmitPayoutCommandV1,
      (command: SubmitPayoutCommandV1) => this.handleSubmit(command),
    );
    await this.consume(
      TOPICS.payoutReconcileV1,
      "payout-connector.reconcile",
      ReconcilePayoutCommandV1,
      (command: ReconcilePayoutCommandV1) => this.handleReconcile(command),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.consumers.map((consumer) => consumer.disconnect()));
  }

  private async consume<T extends { paymentId: string }>(
    topic: string,
    groupId: string,
    schema: ParseableSchema<T>,
    handle: (event: T) => Promise<void>,
  ): Promise<void> {
    const consumer = this.kafka.consumer({ groupId });
    await consumer.connect();
    this.consumers.push(consumer);

    void runConsumer({
      consumer,
      topic,
      schema,
      handler: (event) =>
        withPaymentContext(event.paymentId, () => handle(event)),
    });
  }

  private async handleSubmit(command: SubmitPayoutCommandV1): Promise<void> {
    const outcome = await this.rail.submit(
      command.payload.partnerReference,
      BigInt(command.payload.amount.amountMinorUnits),
      command.payload.amount.currency,
      command.payload.destinationAccountId,
    );

    if (outcome.kind === "ambiguous") {
      await this.requestReconcile(
        command.paymentId,
        command.payload.partnerReference,
        0,
      );
      return;
    }

    await this.publishOutcome(
      command.paymentId,
      command.payload.partnerReference,
      outcome.kind,
      outcome.kind === "rejected" ? outcome.detail : undefined,
    );
  }

  private async handleReconcile(
    command: ReconcilePayoutCommandV1,
  ): Promise<void> {
    const outcome = await this.rail.lookup(command.payload.partnerReference);
    const step = nextReconcileStep(outcome.kind, command.payload.attempts);

    if (step.kind === "resolve") {
      await this.publishOutcome(
        command.paymentId,
        command.payload.partnerReference,
        step.outcome,
      );
      return;
    }

    if (step.kind === "poll-again") {
      await this.requestReconcile(
        command.paymentId,
        command.payload.partnerReference,
        step.attempt,
      );
      return;
    }

    throw new Error(
      `Payout ${command.payload.partnerReference} still ambiguous after ${command.payload.attempts} polls; operator intervention required`,
    );
  }

  private async requestReconcile(
    paymentId: string,
    partnerReference: string,
    attempts: number,
  ): Promise<void> {
    await this.publisher.publish(TOPICS.payoutReconcileV1, {
      key: paymentId,
      payload: {
        version: 1,
        type: "ReconcilePayout",
        paymentId,
        occurredAt: new Date().toISOString(),
        payload: { partnerReference, attempts },
      },
    });
  }

  private async publishOutcome(
    paymentId: string,
    partnerReference: string,
    outcome: "settled" | "rejected",
    detail?: string,
  ): Promise<void> {
    await this.publisher.publish(TOPICS.payoutEventsV1, {
      key: paymentId,
      payload: {
        version: 1,
        type: "PayoutCompleted",
        paymentId,
        occurredAt: new Date().toISOString(),
        payload: { outcome, partnerReference, ...(detail ? { detail } : {}) },
      },
    });
  }
}
