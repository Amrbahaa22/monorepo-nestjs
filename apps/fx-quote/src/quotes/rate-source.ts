export const RATE_SOURCE = Symbol("RATE_SOURCE");

export interface RateSource {
  rateFor(sourceCurrency: string, targetCurrency: string): Promise<string>;
}

// ponytail: fixed rate table stands in for a market data feed. Swap this
// provider for an HTTP client when a real venue is picked — nothing else
// changes, because callers depend on RateSource, not on this class.
const RATES: Record<string, string> = {
  "USD:EUR": "0.9184213",
  "EUR:USD": "1.0888300",
  "USD:GBP": "0.7841200",
  "GBP:USD": "1.2753100",
};

export class StaticRateSource implements RateSource {
  async rateFor(
    sourceCurrency: string,
    targetCurrency: string,
  ): Promise<string> {
    const rate = RATES[`${sourceCurrency}:${targetCurrency}`];
    if (rate === undefined) {
      throw new Error(
        `No rate available for ${sourceCurrency}->${targetCurrency}`,
      );
    }
    return rate;
  }
}
