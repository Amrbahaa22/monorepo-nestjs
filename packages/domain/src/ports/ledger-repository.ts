import type { PostingBatchDraft } from "../posting-batch";

export type ReserveResult = "inserted" | "duplicate";

export interface LedgerRepository {
  reservePostings(batch: PostingBatchDraft): Promise<ReserveResult>;
}
