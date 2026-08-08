import { describe, expect, it } from "@jest/globals";
import { convert, QuoteExpiredError, SameCurrencyQuoteError } from "./fx";
import { Money } from "./money";
import type { Quote } from "./ports/quote-provider";

const now = new Date("2026-08-09T10:00:00.000Z");

function quote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "quote_1",
    sourceCurrency: "USD",
    targetCurrency: "EUR",
    rate: "0.92",
    expiresAt: new Date("2026-08-09T10:00:30.000Z"),
    ...overrides,
  };
}

describe("convert", () => {
  it("converts using the quoted rate", () => {
    const result = convert(Money.of(10000n, "USD"), quote(), now);
    expect(result.minorUnits).toBe(9200n);
    expect(result.currency).toBe("EUR");
  });

  it("keeps full precision on a many-decimal rate", () => {
    const result = convert(
      Money.of(10000n, "USD"),
      quote({ rate: "0.9184213" }),
      now,
    );
    expect(result.minorUnits).toBe(9184n);
  });

  it("rounds half up rather than truncating", () => {
    // 100 * 0.005 = 0.5 minor units -> 1
    const result = convert(
      Money.of(100n, "USD"),
      quote({ rate: "0.005" }),
      now,
    );
    expect(result.minorUnits).toBe(1n);
  });

  it("handles an integer rate with no decimal point", () => {
    const result = convert(Money.of(500n, "USD"), quote({ rate: "3" }), now);
    expect(result.minorUnits).toBe(1500n);
  });

  it("does not lose precision on amounts beyond Number.MAX_SAFE_INTEGER", () => {
    const huge = Money.of(9007199254740993n, "USD");
    const result = convert(huge, quote({ rate: "2" }), now);
    expect(result.minorUnits).toBe(18014398509481986n);
  });

  it("refuses an expired quote", () => {
    const expired = quote({ expiresAt: new Date("2026-08-09T09:59:59.000Z") });
    expect(() => convert(Money.of(100n, "USD"), expired, now)).toThrow(
      QuoteExpiredError,
    );
  });

  it("refuses a quote at the exact expiry instant", () => {
    const expiring = quote({ expiresAt: now });
    expect(() => convert(Money.of(100n, "USD"), expiring, now)).toThrow(
      QuoteExpiredError,
    );
  });

  it("refuses a same-currency quote", () => {
    const same = quote({ targetCurrency: "USD" });
    expect(() => convert(Money.of(100n, "USD"), same, now)).toThrow(
      SameCurrencyQuoteError,
    );
  });

  it("refuses to convert an amount in the wrong source currency", () => {
    expect(() => convert(Money.of(100n, "GBP"), quote(), now)).toThrow();
  });
});
