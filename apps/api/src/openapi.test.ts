import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildOpenApiDocument, formatOpenApiDocument, OPENAPI_OUTPUT } from "./openapi.ts";

describe("OpenAPI document", () => {
  it("matches the copy used by the web app's API reference", async () => {
    const committed = await readFile(OPENAPI_OUTPUT, "utf8");
    const current = formatOpenApiDocument(await buildOpenApiDocument());
    // If this fails, run `pnpm --filter @osg/api openapi` and commit apps/web/openapi.json.
    expect(committed).toBe(current);
  });
});
