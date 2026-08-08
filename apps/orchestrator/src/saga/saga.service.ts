import type {
  PaymentInitiatedEventV1,
  PayoutCompletedEventV1,
  PostingCompletedEventV1,
  RiskDecidedEventV1,
} from "@monorepo/contracts";
import { DATABASE } from "@monorepo/db-kit";
import {
  decide,
  type EventPublisher,
  type PaymentDetails,
  type SagaAction,
  type SagaEvent,
  type SagaState,
} from "@monorepo/domain";
import { EVENT_PUBLISHER } from "@monorepo/kafka-kit";
import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { paymentSaga } from "../db/schema";
import { toWireCommand } from "./wire";

@Injectable()
export class SagaService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher,
  ) {}

  async handlePaymentInitiated(event: PaymentInitiatedEventV1): Promise<void> {
    await this.db
      .insert(paymentSaga)
      .values({
        paymentId: event.paymentId,
        state: "STARTED",
        sourceAccountId: event.payload.sourceAccountId,
        destinationAccountId: event.payload.destinationAccountId,
        amountMinorUnits: BigInt(event.payload.amount.amountMinorUnits),
        currency: event.payload.amount.currency,
      })
      .onConflictDoNothing();

    await this.advance(event.paymentId, { type: "PaymentInitiated" });
  }

  async handlePostingCompleted(event: PostingCompletedEventV1): Promise<void> {
    await this.advance(event.paymentId, {
      type: "PostingCompleted",
      phase: event.payload.phase,
    });
  }

  async handleRiskDecided(event: RiskDecidedEventV1): Promise<void> {
    await this.advance(event.paymentId, {
      type: "RiskDecided",
      decision: event.payload.decision,
    });
  }

  async handlePayoutCompleted(event: PayoutCompletedEventV1): Promise<void> {
    await this.advance(event.paymentId, {
      type: "PayoutCompleted",
      outcome: event.payload.outcome,
    });
  }

  /**
   * Publishes before persisting the new state. A crash between the two leaves
   * the saga on its old state, so redelivery re-runs the same transition and
   * republishes — a duplicate downstream command, which every consumer
   * already absorbs via its own unique constraint. The reverse order would
   * lose the command permanently.
   */
  private async advance(paymentId: string, event: SagaEvent): Promise<void> {
    const [row] = await this.db
      .select()
      .from(paymentSaga)
      .where(eq(paymentSaga.paymentId, paymentId))
      .limit(1);

    if (row === undefined) {
      throw new Error(`No saga for payment ${paymentId}`);
    }

    const details: PaymentDetails = {
      paymentId: row.paymentId,
      sourceAccountId: row.sourceAccountId,
      destinationAccountId: row.destinationAccountId,
      amountMinorUnits: row.amountMinorUnits,
      currency: row.currency,
    };

    const decision = decide(row.state as SagaState, details, event);
    if (decision.nextState === row.state && decision.action.kind === "none") {
      return;
    }

    await this.dispatch(details, decision.action);

    await this.db
      .update(paymentSaga)
      .set({ state: decision.nextState, updatedAt: sql`now()` })
      .where(eq(paymentSaga.paymentId, paymentId));
  }

  private async dispatch(
    details: PaymentDetails,
    action: SagaAction,
  ): Promise<void> {
    if (action.kind === "none") {
      return;
    }

    const { topic, payload } = toWireCommand(details, action);
    await this.publisher.publish(topic, {
      key: details.paymentId,
      payload,
    });
  }
}
