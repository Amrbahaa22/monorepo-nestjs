import { z } from "zod";
import { EnvelopeMetaV1, MoneyWireV1 } from "./envelope";
import { PostingPhaseV1 } from "./ledger-events";

export const PostingLineV1 = z.object({
  accountId: z.string().min(1),
  direction: z.enum(["debit", "credit"]),
  amount: MoneyWireV1,
});

export type PostingLineV1 = z.infer<typeof PostingLineV1>;

export const PostingCommandV1 = EnvelopeMetaV1.extend({
  type: z.literal("PostBatch"),
  payload: z.object({
    phase: PostingPhaseV1,
    lines: z.array(PostingLineV1).min(2),
  }),
});

export type PostingCommandV1 = z.infer<typeof PostingCommandV1>;
