import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const postingBatches = pgTable(
  "posting_batches",
  {
    id: uuid("id").primaryKey(),
    paymentId: uuid("payment_id").notNull(),
    phase: text("phase").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("posting_batches_payment_phase_uq").on(
      table.paymentId,
      table.phase,
    ),
  ],
);

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => postingBatches.id),
    accountId: text("account_id").notNull(),
    direction: text("direction").notNull(),
    amountMinorUnits: bigint("amount_minor_units", {
      mode: "bigint",
    }).notNull(),
    currency: text("currency").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("journal_entries_account_idx").on(table.accountId, table.currency),
  ],
);
