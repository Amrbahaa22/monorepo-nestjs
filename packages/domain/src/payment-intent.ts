import type { Money } from "./money";

export type PaymentIntentStatus = "created" | "submitted";

export interface PaymentIntent {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly amount: Money;
  readonly sourceAccountId: string;
  readonly destinationAccountId: string;
  readonly status: PaymentIntentStatus;
}
