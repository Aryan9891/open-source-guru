import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.ts";

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseConnection {
  db: Database;
  pool: pg.Pool;
  /** Resolves when the database answers a trivial query; used by health checks. */
  ping: () => Promise<void>;
  close: () => Promise<void>;
}

export function createDatabase(url: string, options: { max?: number } = {}): DatabaseConnection {
  const pool = new pg.Pool({ connectionString: url, max: options.max ?? 10 });
  const db = drizzle({ client: pool, schema });

  return {
    db,
    pool,
    ping: async () => {
      await db.execute(sql`select 1`);
    },
    close: () => pool.end(),
  };
}
