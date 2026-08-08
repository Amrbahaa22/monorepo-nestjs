import { z } from "zod";
import { EnvelopeMetaV1, MoneyWireV1 } from "./envelope";

export const ScreenPaymentCommandV1 = EnvelopeMetaV1.extend({
  type: z.literal("ScreenPayment"),
  payload: z.object({
    sourceAccountId: z.string().min(1),
    destinationAccountId: z.string().min(1),
    amount: MoneyWireV1,
  }),
});

export type ScreenPaymentCommandV1 = z.infer<typeof ScreenPaymentCommandV1>;

export const RiskDecisionV1 = z.enum(["approved", "declined"]);

export type RiskDecisionV1 = z.infer<typeof RiskDecisionV1>;

export const RiskDecidedEventV1 = EnvelopeMetaV1.extend({
  type: z.literal("RiskDecided"),
  payload: z.object({
    decision: RiskDecisionV1,
    /** Screening is only meaningful alongside the rules in force at the time. */
    rulesetVersion: z.string().min(1),
    reason: z.string().optional(),
  }),
});

export type RiskDecidedEventV1 = z.infer<typeof RiskDecidedEventV1>;
