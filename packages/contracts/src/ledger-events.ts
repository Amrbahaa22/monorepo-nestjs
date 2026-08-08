import { z } from "zod";
import { EnvelopeMetaV1 } from "./envelope";

export const PostingPhaseV1 = z.enum([
  "reserve",
  "capture",
  "release",
  "reverse",
]);

export type PostingPhaseV1 = z.infer<typeof PostingPhaseV1>;

export const PostingReservedEventV1 = EnvelopeMetaV1.extend({
  type: z.literal("PostingReserved"),
  payload: z.object({
    phase: z.literal("reserve"),
    batchId: z.uuid(),
  }),
});

export type PostingReservedEventV1 = z.infer<typeof PostingReservedEventV1>;

export const PostingCompletedEventV1 = EnvelopeMetaV1.extend({
  type: z.literal("PostingCompleted"),
  payload: z.object({
    phase: PostingPhaseV1,
    batchId: z.uuid(),
  }),
});

export type PostingCompletedEventV1 = z.infer<typeof PostingCompletedEventV1>;
