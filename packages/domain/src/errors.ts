export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class CurrencyMismatchError extends DomainError {
  constructor(expected: string, actual: string) {
    super(`Currency mismatch: expected ${expected}, got ${actual}`);
  }
}

export class UnbalancedBatchError extends DomainError {
  constructor(currency: string, debits: bigint, credits: bigint) {
    super(
      `Unbalanced posting batch in ${currency}: debits=${debits} credits=${credits}`,
    );
  }
}

export class EmptyBatchError extends DomainError {
  constructor() {
    super("Posting batch must contain at least one line");
  }
}
