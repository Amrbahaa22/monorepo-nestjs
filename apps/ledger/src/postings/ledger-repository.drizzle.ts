import { DATABASE } from "@monorepo/db-kit";
import {
  assertBalanced,
  type LedgerRepository,
  type PostingBatchDraft,
  type ReserveResult,
} from "@monorepo/domain";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Database } from "../db/client";
import { journalEntries, postingBatches } from "../db/schema";

export interface PostOutcome {
  readonly result: ReserveResult;
  readonly batchId: string;
}

@Injectable()
export class DrizzleLedgerRepository implements LedgerRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async reservePostings(batch: PostingBatchDraft): Promise<ReserveResult> {
    const outcome = await this.post(batch);
    return outcome.result;
  }

  /**
   * The (payment_id, phase) unique index is the idempotency gate: a duplicate
   * Kafka delivery inserts nothing and returns the existing batch id, so the
   * caller can still republish its completion event.
   */
  async post(batch: PostingBatchDraft): Promise<PostOutcome> {
    assertBalanced(batch);
    const batchId = uuid();

    return this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(postingBatches)
        .values({ id: batchId, paymentId: batch.paymentId, phase: batch.phase })
        .onConflictDoNothing()
        .returning({ id: postingBatches.id });

      if (inserted.length === 0) {
        const [existing] = await tx
          .select({ id: postingBatches.id })
          .from(postingBatches)
          .where(
            and(
              eq(postingBatches.paymentId, batch.paymentId),
              eq(postingBatches.phase, batch.phase),
            ),
          )
          .limit(1);
        return { result: "duplicate" as const, batchId: existing.id };
      }

      await tx.insert(journalEntries).values(
        batch.lines.map((line) => ({
          id: uuid(),
          batchId,
          accountId: line.accountId,
          direction: line.direction,
          amountMinorUnits: line.amount.minorUnits,
          currency: line.amount.currency,
        })),
      );

      return { result: "inserted" as const, batchId };
    });
  }
}
