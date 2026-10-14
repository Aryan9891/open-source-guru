import type { Database } from "@osg/core/db";
import type { GitHubApi } from "@osg/core/github";
import type { EmailLinks } from "@osg/core/links";
import type { EmailSender } from "@osg/core/mail";
import type { Logger } from "pino";

/** Everything jobs need. Built once in worker.ts; built with fakes in tests. */
export interface WorkerContext {
  db: Database;
  github: GitHubApi;
  mailer: EmailSender;
  links: EmailLinks;
  log: Pick<Logger, "info" | "warn" | "error" | "debug">;
  now: () => Date;
}
