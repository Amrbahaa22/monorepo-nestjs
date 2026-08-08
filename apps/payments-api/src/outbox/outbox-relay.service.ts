import type { EventPublisher } from "@monorepo/domain";
import { EVENT_PUBLISHER } from "@monorepo/kafka-kit";
import { Inject, Injectable } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { asc, eq, isNull } from "drizzle-orm";
import type { Redis } from "ioredis";
import { DATABASE, type Database } from "../db/client";
import { outbox } from "../db/schema";
import { REDIS } from "../idempotency/redis.provider";

const LOCK_KEY = "lock:outbox-relay";
const LOCK_TTL_SECONDS = 10;
const BATCH_SIZE = 100;

@Injectable()
export class OutboxRelayService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher,
  ) {}

  @Interval(1000)
  async drain(): Promise<void> {
    const acquired = await this.redis.set(
      LOCK_KEY,
      process.pid.toString(),
      "EX",
      LOCK_TTL_SECONDS,
      "NX",
    );
    if (acquired !== "OK") {
      return;
    }

    const rows = await this.db
      .select()
      .from(outbox)
      .where(isNull(outbox.publishedAt))
      .orderBy(asc(outbox.createdAt))
      .limit(BATCH_SIZE);

    for (const row of rows) {
      await this.publisher.publish(row.topic, {
        key: row.messageKey,
        payload: JSON.parse(row.payload),
      });
      await this.db
        .update(outbox)
        .set({ publishedAt: new Date() })
        .where(eq(outbox.id, row.id));
    }
  }
}
