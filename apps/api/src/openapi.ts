import { createEmailLinks } from "@osg/core/links";
import { type AppDependencies, buildApp } from "./app.ts";

/** Where the web app's API reference reads the spec (`pnpm --filter @osg/api openapi`). */
export const OPENAPI_OUTPUT = new URL("../../web/openapi.json", import.meta.url);

/**
 * The OpenAPI document, without a database or network: registering the routes only needs the
 * email links; everything else is used when handling requests, which never happens here.
 * Requests go through the web app (`/api`), so that's the server.
 */
export async function buildOpenApiDocument() {
  const deps = {
    links: createEmailLinks({ webUrl: "http://localhost", secret: "unused" }),
  } as AppDependencies;
  const app = await buildApp(deps, { logger: false });
  await app.ready();
  const document = { ...app.swagger(), servers: [{ url: "/api", description: "This site" }] };
  await app.close();
  return document;
}

export const formatOpenApiDocument = (document: object) => `${JSON.stringify(document, null, 2)}\n`;
