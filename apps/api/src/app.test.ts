import { describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";

describe("GET /health", () => {
  it("returns 200 when the database is reachable", async () => {
    const app = buildApp({ pingDatabase: async () => {} });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", database: "ok" });
  });

  it("returns 503 when the database is unreachable", async () => {
    const app = buildApp({
      pingDatabase: async () => {
        throw new Error("connection refused");
      },
    });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: "degraded", database: "unavailable" });
  });
});
