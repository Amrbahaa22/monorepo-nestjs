import { z } from "zod";
import { EnvelopeMetaV1, MoneyWireV1 } from "./envelope";

export const PaymentInitiatedEventV1 = EnvelopeMetaV1.extend({
  type: z.literal("PaymentInitiated"),
  payload: z.object({
    sourceAccountId: z.string().min(1),
    destinationAccountId: z.string().min(1),
    amount: MoneyWireV1,
  }),
});

export type PaymentInitiatedEventV1 = z.infer<typeof PaymentInitiatedEventV1>;
