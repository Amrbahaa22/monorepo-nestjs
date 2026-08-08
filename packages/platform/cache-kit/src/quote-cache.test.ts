import { describe, expect, it } from "@jest/globals";
import type { Quote } from "@monorepo/domain";
import { quoteCacheKey, ttlSecondsFor } from "./quote-cache";

const now = new Date("2026-08-09T10:00:00.000Z");

function quoteExpiringAt(expiresAt: string): Quote {
  return {
    id: "quote_1",
    sourceCurrency: "USD",
    targetCurrency: "EUR",
    rate: "0.9184213",
    expiresAt: new Date(expiresAt),
  };
}

describe("ttlSecondsFor", () => {
  it("matches the cache TTL to the quote's remaining life", () => {
    const quote = quoteExpiringAt("2026-08-09T10:00:30.000Z");
    expect(ttlSecondsFor(quote, now)).toBe(30);
  });

  it("returns 0 for an already expired quote so it is never cached", () => {
    const quote = quoteExpiringAt("2026-08-09T09:59:59.000Z");
    expect(ttlSecondsFor(quote, now)).toBe(0);
  });

  it("returns 0 at the exact expiry instant", () => {
    const quote = quoteExpiringAt("2026-08-09T10:00:00.000Z");
    expect(ttlSecondsFor(quote, now)).toBe(0);
  });

  it("floors sub-second remainders rather than rounding up past expiry", () => {
    const quote = quoteExpiringAt("2026-08-09T10:00:30.900Z");
    expect(ttlSecondsFor(quote, now)).toBe(30);
  });
});

describe("quoteCacheKey", () => {
  it("keys by currency pair", () => {
    expect(quoteCacheKey("USD", "EUR")).toBe("fx:quote:USD:EUR");
  });

  it("treats the reverse pair as a different key", () => {
    expect(quoteCacheKey("EUR", "USD")).not.toBe(quoteCacheKey("USD", "EUR"));
  });
});
