import { RedisQuoteCache } from "@monorepo/cache-kit";
import type { Money, Quote, QuoteProvider } from "@monorepo/domain";
import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { v4 as uuid } from "uuid";
import { REDIS } from "../infra.module";
import { RATE_SOURCE, type RateSource } from "./rate-source";

const QUOTE_TTL_SECONDS = Number(process.env.FX_QUOTE_TTL_SECONDS ?? 30);

@Injectable()
export class QuotesService implements QuoteProvider {
  private readonly cache: RedisQuoteCache;

  constructor(
    @Inject(REDIS) redis: Redis,
    @Inject(RATE_SOURCE) private readonly rates: RateSource,
  ) {
    this.cache = new RedisQuoteCache(redis);
  }

  async getQuote(
    sourceCurrency: string,
    targetCurrency: string,
    _sourceAmount: Money,
  ): Promise<Quote> {
    const now = new Date();
    const cached = await this.cache.get(sourceCurrency, targetCurrency, now);
    if (cached !== null) {
      return cached;
    }

    const quote: Quote = {
      id: uuid(),
      sourceCurrency,
      targetCurrency,
      rate: await this.rates.rateFor(sourceCurrency, targetCurrency),
      expiresAt: new Date(now.getTime() + QUOTE_TTL_SECONDS * 1000),
    };

    await this.cache.set(quote, now);
    return quote;
  }
}
