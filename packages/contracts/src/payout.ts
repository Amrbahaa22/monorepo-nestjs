import { z } from "zod";
import { EnvelopeMetaV1, MoneyWireV1 } from "./envelope";

export const SubmitPayoutCommandV1 = EnvelopeMetaV1.extend({
  type: z.literal("SubmitPayout"),
  payload: z.object({
    destinationAccountId: z.string().min(1),
    amount: MoneyWireV1,
    /** Derived from paymentId so a reconcile poll can find the transfer. */
    partnerReference: z.string().min(1),
  }),
});

export type SubmitPayoutCommandV1 = z.infer<typeof SubmitPayoutCommandV1>;

export const PayoutOutcomeV1 = z.enum(["settled", "rejected"]);

export type PayoutOutcomeV1 = z.infer<typeof PayoutOutcomeV1>;

export const PayoutCompletedEventV1 = EnvelopeMetaV1.extend({
  type: z.literal("PayoutCompleted"),
  payload: z.object({
    outcome: PayoutOutcomeV1,
    partnerReference: z.string().min(1),
    detail: z.string().optional(),
  }),
});

export type PayoutCompletedEventV1 = z.infer<typeof PayoutCompletedEventV1>;

/**
 * A timeout from the rail is ambiguous, not failed. These messages are never
 * a re-send: they ask the partner what actually happened.
 */
export const ReconcilePayoutCommandV1 = EnvelopeMetaV1.extend({
  type: z.literal("ReconcilePayout"),
  payload: z.object({
    partnerReference: z.string().min(1),
    attempts: z.number().int().min(0),
  }),
});

export type ReconcilePayoutCommandV1 = z.infer<typeof ReconcilePayoutCommandV1>;
