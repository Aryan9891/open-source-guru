import { resources } from "../_data/resources";

const hostname = (url: string) => new URL(url).hostname.replace(/^www\./, "");

/** Landing page section: where to find projects to contribute to. */
export function ResourcesSection() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6">
        <div className="flex flex-col gap-2">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Resources</p>
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Not sure where to start?
          </h2>
          <p className="max-w-2xl text-subtle">
            These sites help you find projects that welcome new contributors. Found one you like?
            Follow it here and we'll tell you when there's an issue for you.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {resources.map((resource) => (
            <li key={resource.url}>
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-full flex-col gap-2 rounded-lg border border-border bg-surface p-6 transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="flex items-center justify-between gap-4">
                  <span className="text-lg font-semibold group-hover:text-accent">
                    {resource.name}
                  </span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-4 shrink-0 fill-none stroke-current text-muted group-hover:text-accent"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M7 17 17 7M8 7h9v9" />
                  </svg>
                </span>
                <span className="text-subtle">{resource.description}</span>
                <span className="mt-auto font-mono text-sm text-muted">
                  {hostname(resource.url)}
                  <span className="sr-only"> (opens in a new tab)</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
