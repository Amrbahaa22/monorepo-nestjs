import type { Money } from "../money";

export interface Quote {
  readonly id: string;
  readonly sourceCurrency: string;
  readonly targetCurrency: string;
  readonly rate: string;
  readonly expiresAt: Date;
}

export interface QuoteProvider {
  getQuote(
    sourceCurrency: string,
    targetCurrency: string,
    sourceAmount: Money,
  ): Promise<Quote>;
}
