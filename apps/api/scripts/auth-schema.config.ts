// Used only by `pnpm auth:schema` to generate the Drizzle schema of the Better Auth tables
// (packages/core/src/db/schema/auth.ts). Never imported at runtime.
import { createDatabase } from "@osg/core/db";
import { createAuth } from "../src/auth.ts";

export const auth = createAuth({
  db: createDatabase("postgres://unused@localhost/unused").db,
  secret: "schema-generation-only-secret-000000000",
  webUrl: "http://localhost:3000",
  github: { clientId: "unused", clientSecret: "unused" },
});
