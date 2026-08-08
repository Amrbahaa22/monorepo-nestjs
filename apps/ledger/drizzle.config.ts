import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.LEDGER_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/ledger",
  },
} satisfies Config;
