import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "./schema/index.ts";

export type Database = NodePgDatabase<typeof schema>;

/** A database handle usable both outside and inside `db.transaction(...)`. */
export type DatabaseOrTransaction =
  | Database
  | Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface DatabaseConnection {
  db: Database;
  pool: pg.Pool;
  /** Resolves when the database answers a trivial query; used by health checks. */
  ping: () => Promise<void>;
  close: () => Promise<void>;
}

export const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

export function createDatabase(url: string, options: { max?: number } = {}): DatabaseConnection {
  const pool = new pg.Pool({ connectionString: url, max: options.max ?? 10 });
  // Must match `casing` in drizzle.config.ts.
  const db = drizzle({ client: pool, schema, casing: "snake_case" });

  return {
    db,
    pool,
    ping: async () => {
      await db.execute(sql`select 1`);
    },
    close: () => pool.end(),
  };
}

/** Applies pending migrations from `packages/core/drizzle`. */
export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder });
}
