import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.PAYMENTS_API_DATABASE_URL ??
      "postgres://postgres:postgres@localhost:5432/payments_api",
  },
} satisfies Config;
