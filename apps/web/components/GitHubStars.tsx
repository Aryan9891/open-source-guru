import { fetchRepositoryInfo } from "fumadocs-ui/components/github-info";
import { cacheLife } from "next/cache";
import { githubRepo } from "@/lib/shared";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

async function getStars(): Promise<number | null> {
  "use cache";
  // Fetched at build time, then refreshed at most once an hour (GitHub allows 60 anonymous
  // requests per hour).
  cacheLife("hours");
  try {
    const info = await fetchRepositoryInfo({
      owner: githubRepo.owner,
      repo: githubRepo.name,
      fetchOptions: {},
    });
    return info.stars;
  } catch {
    // GitHub unreachable or rate-limited: show the icon without a count.
    return null;
  }
}

/** "Star us on GitHub" link with the repository's star count, for the top-right of the nav. */
export async function GitHubStars() {
  const stars = await getStars();
  // GitHub can't star from a link: this opens the repo, where people click GitHub's Star button.
  const label =
    stars === null
      ? "Star Open Source Guru on GitHub"
      : `Star Open Source Guru on GitHub (${stars} ${stars === 1 ? "star" : "stars"})`;

  return (
    <a
      href={githubRepo.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title="Star us on GitHub"
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-5 fill-current">
        <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
      </svg>
      {stars !== null && (
        <span className="inline-flex items-center gap-1">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-3.5 fill-none stroke-current"
            strokeWidth="2"
            strokeLinejoin="round"
          >
            <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
          </svg>
          {compact.format(stars)}
        </span>
      )}
    </a>
  );
}
