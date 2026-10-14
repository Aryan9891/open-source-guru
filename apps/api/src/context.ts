import type { Database } from "@osg/core/db";
import type { GitHubApi } from "@osg/core/github";
import type { EmailLinks } from "@osg/core/links";
import type { EmailSender } from "@osg/core/mail";
import type { Auth } from "./auth.ts";

/** Everything routes need. Built once in server.ts; built with fakes in tests. */
export interface ApiContext {
  db: Database;
  auth: Auth;
  github: GitHubApi;
  mailer: EmailSender;
  links: EmailLinks;
  /** Secret of the signed links in emails (unsubscribe, address verification). */
  emailTokenSecret: string;
  now: () => Date;
}
