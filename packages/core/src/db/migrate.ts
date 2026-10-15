// Applies pending migrations, then exits. Production runs it as the one-off `migrate`
// container before `api` and `worker` start (see docker-compose.prod.yml).
import { baseEnvSchema, parseEnv } from "../env.ts";
import { createDatabase, runMigrations } from "./index.ts";

const env = parseEnv(baseEnvSchema);
const database = createDatabase(env.DATABASE_URL, { max: 1 });

try {
  await runMigrations(database.db);
  console.log("migrations applied");
} finally {
  await database.close();
}
