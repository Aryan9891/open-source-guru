import { describe, expect, it } from "vitest";
import { z } from "zod";
import { baseEnvSchema, EnvError, parseEnv } from "./env.ts";

describe("parseEnv", () => {
  it("applies defaults and returns typed values", () => {
    const env = parseEnv(baseEnvSchema, { DATABASE_URL: "postgres://osg:osg@localhost:5432/osg" });

    expect(env).toEqual({
      NODE_ENV: "development",
      LOG_LEVEL: "info",
      DATABASE_URL: "postgres://osg:osg@localhost:5432/osg",
    });
  });

  it("supports app-specific extensions of the base schema", () => {
    const schema = baseEnvSchema.extend({ API_PORT: z.coerce.number().int() });

    const env = parseEnv(schema, { DATABASE_URL: "postgresql://localhost/osg", API_PORT: "4000" });

    expect(env.API_PORT).toBe(4000);
  });

  it("throws an EnvError naming every invalid variable", () => {
    const parse = () =>
      parseEnv(baseEnvSchema, { DATABASE_URL: "mysql://localhost/osg", NODE_ENV: "staging" });

    expect(parse).toThrow(EnvError);
    expect(parse).toThrow(/DATABASE_URL/);
    expect(parse).toThrow(/NODE_ENV/);
  });
});
