import { TOPICS } from "@monorepo/contracts";
import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { DATABASE, type Database } from "../db/client";
import { outbox, paymentIntents } from "../db/schema";
import { IdempotencyService } from "../idempotency/idempotency.service";
import type { CreatePaymentRequest } from "./create-payment.dto";

export interface CreatePaymentResult {
  readonly paymentId: string;
  readonly duplicate: boolean;
}

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly idempotency: IdempotencyService,
  ) {}

  async createPayment(
    idempotencyKey: string,
    request: CreatePaymentRequest,
  ): Promise<CreatePaymentResult> {
    const paymentId = uuid();
    const claim = await this.idempotency.claim(idempotencyKey, paymentId);

    if (!claim.claimed) {
      return { paymentId: claim.existingPaymentId, duplicate: true };
    }

    const existing = await this.db
      .select({ id: paymentIntents.id })
      .from(paymentIntents)
      .where(eq(paymentIntents.idempotencyKey, idempotencyKey))
      .limit(1);

    if (existing.length > 0) {
      return { paymentId: existing[0].id, duplicate: true };
    }

    await this.db.transaction(async (tx) => {
      await tx.insert(paymentIntents).values({
        id: paymentId,
        idempotencyKey,
        sourceAccountId: request.sourceAccountId,
        destinationAccountId: request.destinationAccountId,
        amountMinorUnits: BigInt(request.amountMinorUnits),
        currency: request.currency,
        status: "created",
      });

      await tx.insert(outbox).values({
        id: uuid(),
        aggregateId: paymentId,
        topic: TOPICS.paymentEventsV1,
        messageKey: paymentId,
        payload: JSON.stringify({
          version: 1,
          type: "PaymentInitiated",
          paymentId,
          occurredAt: new Date().toISOString(),
          payload: {
            sourceAccountId: request.sourceAccountId,
            destinationAccountId: request.destinationAccountId,
            amount: {
              amountMinorUnits: request.amountMinorUnits,
              currency: request.currency,
            },
          },
        }),
      });
    });

    return { paymentId, duplicate: false };
  }
}
