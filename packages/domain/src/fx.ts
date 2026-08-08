import { DomainError } from "./errors";
import { Money } from "./money";
import type { Quote } from "./ports/quote-provider";

export class QuoteExpiredError extends DomainError {
  constructor(quoteId: string, expiresAt: Date) {
    super(`Quote ${quoteId} expired at ${expiresAt.toISOString()}`);
  }
}

export class SameCurrencyQuoteError extends DomainError {
  constructor(currency: string) {
    super(`Cannot quote ${currency} against itself`);
  }
}

export function assertQuoteUsable(quote: Quote, now: Date): void {
  if (quote.sourceCurrency === quote.targetCurrency) {
    throw new SameCurrencyQuoteError(quote.sourceCurrency);
  }
  if (quote.expiresAt.getTime() <= now.getTime()) {
    throw new QuoteExpiredError(quote.id, quote.expiresAt);
  }
}

/**
 * Converts using integer arithmetic scaled by the rate's own decimal places,
 * so no step ever touches a float. Rounds half-up on the final division only.
 */
export function convert(amount: Money, quote: Quote, now: Date): Money {
  assertQuoteUsable(quote, now);

  if (amount.currency !== quote.sourceCurrency) {
    throw new DomainError(
      `Quote is ${quote.sourceCurrency}->${quote.targetCurrency}, cannot convert ${amount.currency}`,
    );
  }

  const [whole, fraction = ""] = quote.rate.split(".");
  const scale = 10n ** BigInt(fraction.length);
  const scaledRate = BigInt(`${whole}${fraction}`);

  const numerator = amount.minorUnits * scaledRate;
  const rounded = (numerator * 2n + scale) / (scale * 2n);

  return Money.of(rounded, quote.targetCurrency);
}
