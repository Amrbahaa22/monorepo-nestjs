import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const DATABASE = Symbol("DATABASE");

export type Database<TSchema extends Record<string, unknown>> =
  PostgresJsDatabase<TSchema> & { $client: postgres.Sql };

export interface DatabaseOptions {
  readonly connectionString: string;
  readonly maxConnections?: number;
}

/**
 * Each service passes its OWN schema. db-kit owns the connection plumbing;
 * it deliberately does not own any table definitions, so one service can
 * never reach into another's tables.
 */
export function createDatabase<TSchema extends Record<string, unknown>>(
  schema: TSchema,
  options: DatabaseOptions,
): Database<TSchema> {
  const client = postgres(options.connectionString, {
    max: options.maxConnections ?? 10,
  });
  return drizzle(client, { schema }) as Database<TSchema>;
}
