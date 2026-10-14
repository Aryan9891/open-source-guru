import { baseEnvSchema, parseEnv } from "@osg/core/env";
import { z } from "zod";

export const apiEnvSchema = baseEnvSchema.extend({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const loadApiEnv = () => parseEnv(apiEnvSchema);
