import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const paymentIntents = pgTable(
  "payment_intents",
  {
    id: uuid("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    sourceAccountId: text("source_account_id").notNull(),
    destinationAccountId: text("destination_account_id").notNull(),
    amountMinorUnits: bigint("amount_minor_units", {
      mode: "bigint",
    }).notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("payment_intents_idempotency_key_uq").on(table.idempotencyKey),
  ],
);

export const outbox = pgTable(
  "outbox",
  {
    id: uuid("id").primaryKey(),
    aggregateId: uuid("aggregate_id").notNull(),
    topic: text("topic").notNull(),
    messageKey: text("message_key").notNull(),
    payload: text("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    index("outbox_unpublished_idx").on(table.publishedAt, table.createdAt),
  ],
);
