import { z } from "zod";

/** Wire representation of Money — bigint as decimal string for JSON. */
export const MoneyWireV1 = z.object({
  amountMinorUnits: z.string().regex(/^-?\d+$/),
  currency: z.string().length(3),
});

export type MoneyWireV1 = z.infer<typeof MoneyWireV1>;

export const EnvelopeMetaV1 = z.object({
  version: z.literal(1),
  paymentId: z.string().min(1),
  occurredAt: z.iso.datetime(),
});

export type EnvelopeMetaV1 = z.infer<typeof EnvelopeMetaV1>;
