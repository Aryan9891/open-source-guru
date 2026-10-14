// Test helper: a throwaway PostgreSQL (Testcontainers) with migrations applied.

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { createDatabase, type DatabaseConnection, runMigrations } from "../db/index.ts";
import { sql } from "../db/query.ts";

export interface TestDatabase extends DatabaseConnection {
  /** Empties every table, keeping the schema. */
  reset: () => Promise<void>;
  stop: () => Promise<void>;
}

export async function startTestDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer("postgres:18-alpine").start();
  const connection = createDatabase(container.getConnectionUri(), { max: 5 });
  await runMigrations(connection.db);

  return {
    ...connection,
    async reset() {
      const { rows } = await connection.pool.query<{ tablename: string }>(
        "select tablename from pg_tables where schemaname = 'public'",
      );
      if (rows.length === 0) return;
      await connection.db.execute(
        sql.raw(`truncate ${rows.map((row) => `"${row.tablename}"`).join(", ")} cascade`),
      );
    },
    async stop() {
      await connection.close();
      await container.stop();
    },
  };
}

/**
 * Starts a database for the current test file and empties it before each test.
 * Returns a getter, because the database only exists once `beforeAll` has run.
 */
export function useTestDatabase(): () => TestDatabase {
  let database: TestDatabase | undefined;
  beforeAll(async () => {
    database = await startTestDatabase();
  });
  afterAll(async () => {
    await database?.stop();
  });
  beforeEach(async () => {
    await database?.reset();
  });
  return () => {
    if (!database) throw new Error("The test database is not started yet");
    return database;
  };
}

/** The single row of a query result; throws when there is none. */
export function one<T>(rows: T[]): T {
  const [row] = rows;
  if (row === undefined) throw new Error("Expected one row, got none");
  return row;
}
