import Link from "next/link";
import { AccountLink } from "@/components/auth/AccountLink";
import { LogoMark } from "@/components/Logo";
import { buttonClasses } from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants";
import { appName, githubRepoUrl } from "@/lib/shared";
import { HeroActions } from "./_components/HeroActions";
import { RepoTeaser } from "./_components/RepoTeaser";
import { ResourcesSection } from "./_components/ResourcesSection";

const steps = [
  {
    title: "Follow a repository",
    body: "Pick the projects you'd like to help and the labels that fit you, like help wanted or good first issue.",
  },
  {
    title: "We watch GitHub",
    body: "Every couple of minutes we check for new issues with those labels, and labels added to existing ones.",
  },
  {
    title: "You get an email",
    body: "Right away, or as an hourly or daily digest. Each email shows whether the issue is already taken.",
  },
];

const comingSoon: { title: string; body: string }[] = [];

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">{eyebrow}</p>
      <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
    </div>
  );
}

/** A static preview of a notification email. */
function EmailPreview() {
  return (
    <figure className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
      <figcaption className="flex items-center gap-3 border-b border-border pb-4">
        <LogoMark size={32} />
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold">{appName}</span>
          <span className="truncate text-sm text-muted">
            freeCodeCamp/freeCodeCamp#57812: Add keyboard shortcuts to the editor
          </span>
        </div>
      </figcaption>
      <p className="text-sm">1 issue matched your subscriptions.</p>
      <div className="flex flex-col gap-2 border-l-4 border-accent pl-4">
        <p className="font-semibold text-accent">
          #57812 Add keyboard shortcuts to the curriculum editor
        </p>
        <p className="text-sm text-muted">
          Labeled help wanted — labels: help wanted, scope: curriculum
        </p>
        <p className="text-sm text-muted">Not assigned yet</p>
      </div>
      <p className="text-xs text-muted">
        Stop emails for freeCodeCamp/freeCodeCamp · Manage subscriptions
      </p>
    </figure>
  );
}

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div className="flex flex-col gap-6">
          <p className="inline-flex w-fit items-center gap-2 rounded-full bg-chip px-3 py-1 text-sm font-semibold text-chip-foreground">
            <span aria-hidden="true" className="size-2 rounded-full bg-highlight" />
            Free and open source
          </p>
          <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
            Your next good first issue is waiting.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-subtle">
            {appName} emails you when issues you can help with appear in the open-source projects
            you care about. No more refreshing issue pages.
          </p>
          <HeroActions shortText={true} />
        </div>
        <RepoTeaser />
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col gap-8">
            <SectionHeading eyebrow="How it works" title="Three steps, then it runs on its own" />
            <ol className="flex flex-col gap-6">
              {steps.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary font-display text-lg font-extrabold text-primary-foreground">
                    {index + 1}
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                    <p className="text-subtle">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <EmailPreview />
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-4">
          <SectionHeading eyebrow="For developers" title="Use it from your own tools" />
          <p className="text-subtle">
            Everything in the dashboard is also available through a REST API. Create a personal API
            key in your settings and manage subscriptions from scripts, bots or your own app.
          </p>
          <Link
            href={ROUTES.docs}
            className={buttonClasses({ variant: "secondary", className: "w-fit" })}
          >
            API documentation
          </Link>
        </div>
        <pre className="overflow-x-auto rounded-xl bg-plum p-6 font-mono text-sm leading-relaxed text-petal">
          <code>
            <span className="text-wisteria"># Follow help wanted issues in freeCodeCamp</span>
            {"\n"}curl https://&lt;domain&gt;/api/v1/me/subscriptions \{"\n"}
            {"  "}-H <span className="text-coral">"Authorization: Bearer $OSG_KEY"</span> \{"\n"}
            {"  "}-H <span className="text-coral">"content-type: application/json"</span> \{"\n"}
            {"  "}-d{" "}
            <span className="text-coral">
              '{"{"}"repo": "freeCodeCamp/freeCodeCamp", "labels": ["help wanted"]{"}"}'
            </span>
          </code>
        </pre>
      </section>

      <ResourcesSection />

      {comingSoon.length > 0 && (
        <section className="border-t border-border bg-surface">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6">
            <SectionHeading eyebrow="Coming soon" title="Stay motivated" />
            <ul className="grid gap-4 sm:grid-cols-3">
              {comingSoon.map((item) => (
                <li
                  key={item.title}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-background p-6"
                >
                  <span className="w-fit rounded-full bg-chip px-2.5 py-0.5 text-xs font-semibold text-chip-foreground">
                    Coming soon
                  </span>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="text-subtle">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            {appName} is open source.{" "}
            <a
              href={githubRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:text-accent"
            >
              View it on GitHub
            </a>
          </p>
          <nav aria-label="Footer" className="flex gap-6">
            <Link href={ROUTES.docs} className="hover:text-foreground">
              Docs
            </Link>
            <AccountLink variant="link" />
          </nav>
        </div>
      </footer>
    </main>
  );
}
