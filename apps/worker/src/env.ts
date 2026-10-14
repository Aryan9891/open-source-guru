import { baseEnvSchema, emailEnvSchema, githubAppEnvSchema, parseEnv } from "@osg/core/env";
import type { z } from "zod";

export const workerEnvSchema = baseEnvSchema
  .extend(githubAppEnvSchema.shape)
  .extend(emailEnvSchema.shape);

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export const loadWorkerEnv = () => parseEnv(workerEnvSchema);
