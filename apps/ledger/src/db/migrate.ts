import { join } from "node:path";
import { runMigrations } from "@monorepo/db-kit";
import postgres from "postgres";

export async function migrate(): Promise<string[]> {
  const sql = postgres(
    process.env.LEDGER_DATABASE_URL ??
      "postgres://postgres:postgres@localhost:5432/ledger",
    { max: 1 },
  );
  try {
    return await runMigrations(sql, join(__dirname, "migrations"));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
