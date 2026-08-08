import { z } from "zod";
import { EnvelopeMetaV1 } from "./envelope";

export const FailureReasonV1 = z.enum([
  "risk_declined",
  "quote_expired",
  "insufficient_funds",
  "rail_rejected",
]);

export type FailureReasonV1 = z.infer<typeof FailureReasonV1>;

export const PaymentFailedEventV1 = EnvelopeMetaV1.extend({
  type: z.literal("PaymentFailed"),
  payload: z.object({
    reason: FailureReasonV1,
    detail: z.string().optional(),
  }),
});

export type PaymentFailedEventV1 = z.infer<typeof PaymentFailedEventV1>;
