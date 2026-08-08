import { z } from "zod";

export const CreatePaymentRequest = z.object({
  sourceAccountId: z.string().min(1),
  destinationAccountId: z.string().min(1),
  amountMinorUnits: z
    .string()
    .regex(/^\d+$/, "amount must be a positive integer string"),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, "currency must be an ISO-4217 alpha code"),
});

export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequest>;
