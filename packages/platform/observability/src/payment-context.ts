import { AsyncLocalStorage } from "node:async_hooks";

interface PaymentContext {
  readonly paymentId: string;
}

const storage = new AsyncLocalStorage<PaymentContext>();

/**
 * Binds paymentId to everything executed inside fn, including async
 * continuations, so log lines carry it without being threaded through
 * every function signature.
 */
export function withPaymentContext<T>(
  paymentId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run({ paymentId }, fn);
}

export function currentPaymentId(): string | undefined {
  return storage.getStore()?.paymentId;
}
