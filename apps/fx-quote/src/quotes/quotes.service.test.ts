import { describe, expect, it } from "@jest/globals";
import { Money } from "@monorepo/domain";
import type { Redis } from "ioredis";
import { QuotesService } from "./quotes.service";
import type { RateSource } from "./rate-source";

function fakeRedis(store: Map<string, string>, calls: string[]) {
  return {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string, _ex: string, ttl: number) => {
      calls.push(`set:${key}:ttl=${ttl}`);
      store.set(key, value);
      return "OK";
    },
  } as unknown as Redis;
}

const rates: RateSource = { rateFor: async () => "0.9184213" };

describe("QuotesService.getQuote", () => {
  it("caches a fresh quote with a TTL matching its expiry", async () => {
    const calls: string[] = [];
    const service = new QuotesService(fakeRedis(new Map(), calls), rates);

    const quote = await service.getQuote("USD", "EUR", Money.of(1000n, "USD"));

    expect(quote.rate).toBe("0.9184213");
    expect(quote.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(calls[0]).toMatch(/^set:fx:quote:USD:EUR:ttl=(29|30)$/);
  });

  it("serves the cached quote instead of re-quoting", async () => {
    const calls: string[] = [];
    const store = new Map<string, string>();
    const service = new QuotesService(fakeRedis(store, calls), rates);

    const first = await service.getQuote("USD", "EUR", Money.of(1000n, "USD"));
    const second = await service.getQuote("USD", "EUR", Money.of(9999n, "USD"));

    expect(second.id).toBe(first.id);
    expect(calls).toHaveLength(1);
  });

  it("re-quotes when the cached entry has already expired", async () => {
    const calls: string[] = [];
    const store = new Map<string, string>();
    store.set(
      "fx:quote:USD:EUR",
      JSON.stringify({
        id: "stale",
        sourceCurrency: "USD",
        targetCurrency: "EUR",
        rate: "0.5",
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    );
    const service = new QuotesService(fakeRedis(store, calls), rates);

    const quote = await service.getQuote("USD", "EUR", Money.of(1000n, "USD"));

    expect(quote.id).not.toBe("stale");
    expect(quote.rate).toBe("0.9184213");
  });
});
