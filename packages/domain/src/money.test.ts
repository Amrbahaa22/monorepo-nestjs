import { describe, expect, it } from "@jest/globals";
import { CurrencyMismatchError } from "./errors";
import { Money } from "./money";

describe("Money", () => {
  it("adds two amounts in the same currency", () => {
    const a = Money.of(1000n, "USD");
    const b = Money.of(250n, "USD");
    expect(a.add(b).minorUnits).toBe(1250n);
  });

  it("throws when adding different currencies", () => {
    const usd = Money.of(1000n, "USD");
    const eur = Money.of(1000n, "EUR");
    expect(() => usd.add(eur)).toThrow(CurrencyMismatchError);
  });

  it("subtracts amounts in the same currency", () => {
    const a = Money.of(1000n, "USD");
    const b = Money.of(300n, "USD");
    expect(a.subtract(b).minorUnits).toBe(700n);
  });

  it("negate flips sign, keeps currency", () => {
    const a = Money.of(500n, "USD");
    expect(a.negate().minorUnits).toBe(-500n);
    expect(a.negate().currency).toBe("USD");
  });

  it("normalizes currency code to uppercase", () => {
    expect(Money.of(100n, "usd").currency).toBe("USD");
  });

  it("rejects a currency code that is not 3 letters", () => {
    expect(() => Money.of(100n, "US")).toThrow();
  });

  it("zero() creates a zero-value amount", () => {
    expect(Money.zero("USD").isZero()).toBe(true);
  });
});
