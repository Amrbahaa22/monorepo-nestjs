import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { REDIS } from "./redis.provider";

const TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class IdempotencyService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async claim(
    key: string,
    paymentId: string,
  ): Promise<{ claimed: boolean; existingPaymentId: string }> {
    const redisKey = `idempotency:${key}`;
    const result = await this.redis.set(
      redisKey,
      paymentId,
      "EX",
      TTL_SECONDS,
      "NX",
    );

    if (result === "OK") {
      return { claimed: true, existingPaymentId: paymentId };
    }

    const existing = await this.redis.get(redisKey);
    return { claimed: false, existingPaymentId: existing ?? paymentId };
  }
}
