import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

// Docs search (Orama, built in). Defined as a route handler, so it takes precedence
// over the /api/* rewrite to the Fastify API.
export const { GET } = createFromSource(source);
