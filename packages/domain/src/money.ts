import { CurrencyMismatchError } from "./errors";

export type CurrencyCode = string;

export class Money {
  private constructor(
    public readonly minorUnits: bigint,
    public readonly currency: CurrencyCode,
  ) {
    if (currency.length !== 3) {
      throw new Error(
        `Money currency must be a 3-letter ISO-4217 code, got "${currency}"`,
      );
    }
  }

  static of(minorUnits: bigint, currency: CurrencyCode): Money {
    return new Money(minorUnits, currency.toUpperCase());
  }

  static zero(currency: CurrencyCode): Money {
    return Money.of(0n, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.minorUnits + other.minorUnits, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.minorUnits - other.minorUnits, this.currency);
  }

  negate(): Money {
    return Money.of(-this.minorUnits, this.currency);
  }

  isZero(): boolean {
    return this.minorUnits === 0n;
  }

  isNegative(): boolean {
    return this.minorUnits < 0n;
  }

  equals(other: Money): boolean {
    return (
      this.minorUnits === other.minorUnits && this.currency === other.currency
    );
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }
}
