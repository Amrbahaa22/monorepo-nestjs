import {
  bigint,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const paymentSaga = pgTable(
  "payment_saga",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: text("payment_id").notNull(),
    state: text("state").notNull(),
    sourceAccountId: text("source_account_id").notNull(),
    destinationAccountId: text("destination_account_id").notNull(),
    amountMinorUnits: bigint("amount_minor_units", {
      mode: "bigint",
    }).notNull(),
    currency: text("currency").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("payment_saga_payment_id_uq").on(table.paymentId)],
);
