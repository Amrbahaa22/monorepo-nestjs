import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type postgres from "postgres";

const MIGRATIONS_TABLE = "schema_migrations";

/**
 * Applied names are excluded; the rest run in lexical order, which is why
 * migration files are numbered (0000_, 0001_, ...). Ordering is a property of
 * the filename, never of directory listing order.
 */
export function pendingMigrations(
  available: readonly string[],
  applied: readonly string[],
): string[] {
  const done = new Set(applied);
  return available
    .filter((name) => name.endsWith(".sql"))
    .filter((name) => !done.has(name))
    .sort();
}

export async function runMigrations(
  sql: postgres.Sql,
  directory: string,
): Promise<string[]> {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const appliedRows = await sql.unsafe<{ name: string }[]>(
    `SELECT name FROM ${MIGRATIONS_TABLE}`,
  );
  const pending = pendingMigrations(
    readdirSync(directory),
    appliedRows.map((row) => row.name),
  );

  for (const name of pending) {
    const body = readFileSync(join(directory, name), "utf8");
    // One transaction per migration: a failure leaves earlier ones applied
    // and this one fully rolled back, never half-applied.
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx.unsafe(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`, [
        name,
      ]);
    });
  }

  return pending;
}
