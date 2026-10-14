// Writes the OpenAPI document read by the web app's API reference.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildOpenApiDocument, formatOpenApiDocument, OPENAPI_OUTPUT } from "../src/openapi.ts";

await writeFile(OPENAPI_OUTPUT, formatOpenApiDocument(await buildOpenApiDocument()));
console.log(`Wrote ${fileURLToPath(OPENAPI_OUTPUT)}`);
