import path from "node:path";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  cacheComponents: true,
  partialPrefetching: true,
  // Self-hosted with Docker (PLAN.md §14); trace files from the monorepo root.
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The browser only talks to the web app; /api/* is forwarded to the Fastify API
  // over the internal network, so cookies stay first-party and CORS isn't needed.
  // Better Auth is served at /api/auth/* on the API too, so that path is kept as is.
  async rewrites() {
    return [
      { source: "/api/auth/:path*", destination: `${apiInternalUrl}/api/auth/:path*` },
      { source: "/api/:path*", destination: `${apiInternalUrl}/:path*` },
    ];
  },
};

export default withMDX(nextConfig);
