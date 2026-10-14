import { createOpenAPI } from "fumadocs-openapi/server";

/** The API's OpenAPI document, written by `pnpm --filter @osg/api openapi`. */
export const openapi = createOpenAPI({ input: ["./openapi.json"] });
