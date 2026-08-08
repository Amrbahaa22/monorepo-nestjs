import type { Quote } from "@monorepo/domain";
import type { Redis } from "ioredis";

export function quoteCacheKey(
  sourceCurrency: string,
  targetCurrency: string,
): string {
  return `fx:quote:${sourceCurrency}:${targetCurrency}`;
}

/**
 * Cache TTL is derived from the quote's own expiry, never a fixed duration:
 * serving a rate past its expiry is quoting a price you did not commit to.
 * Returns 0 when the quote is already expired, meaning "do not cache".
 */
export function ttlSecondsFor(quote: Quote, now: Date): number {
  const remainingMs = quote.expiresAt.getTime() - now.getTime();
  return remainingMs <= 0 ? 0 : Math.floor(remainingMs / 1000);
}

export class RedisQuoteCache {
  constructor(private readonly redis: Redis) {}

  async get(
    sourceCurrency: string,
    targetCurrency: string,
    now: Date,
  ): Promise<Quote | null> {
    const raw = await this.redis.get(
      quoteCacheKey(sourceCurrency, targetCurrency),
    );
    if (raw === null) {
      return null;
    }

    const parsed = JSON.parse(raw) as Omit<Quote, "expiresAt"> & {
      expiresAt: string;
    };
    const quote: Quote = { ...parsed, expiresAt: new Date(parsed.expiresAt) };

    return ttlSecondsFor(quote, now) === 0 ? null : quote;
  }

  async set(quote: Quote, now: Date): Promise<void> {
    const ttl = ttlSecondsFor(quote, now);
    if (ttl === 0) {
      return;
    }

    await this.redis.set(
      quoteCacheKey(quote.sourceCurrency, quote.targetCurrency),
      JSON.stringify(quote),
      "EX",
      ttl,
    );
  }
}
