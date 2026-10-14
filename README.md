# Open Source Guru

Get email alerts when issues in open-source repos you follow are opened with, or given, labels like
"help wanted", and track your Open Source Contributions, through a web app or an API.

## Repository layout

```
apps/
  api/       Fastify REST API
  worker/    pg-boss background jobs
  web/       Next.js web app + Fumadocs docs
packages/
  core/      Shared code: environment validation, database schema and client, GitHub client,
             change detection, subscription matching, email sending, signed email links
  emails/    React Email templates (compiled to dist/; the only package with a build step)
docs/        Contributor documentation (e.g. GitHub App setup)
```

## Requirements

- Node.js 24 or later
- pnpm 12 (`corepack enable` picks the version from `package.json`)
- Docker with Docker Compose (also used by the integration tests, through Testcontainers)
- A GitHub App for development: see [docs/github-app.md](docs/github-app.md)

## Getting started

```bash
pnpm install          # also installs the git hooks (lefthook)
cp .env.example .env  # then fill in the secrets and the GitHub App values
pnpm db:up            # Postgres on :5433, Mailpit on :1025 (SMTP) and :8025 (web UI)
pnpm db:migrate
pnpm dev              # api on :4000, worker, web on :3000
```

Generate `BETTER_AUTH_SECRET` and `EMAIL_TOKEN_SECRET` with `openssl rand -base64 32`, and put the
GitHub App's private key in `secrets/` (git-ignored), referenced by its absolute path.

- Web app: http://localhost:3000 (docs at `/docs`)
- API: http://localhost:4000 (health at `/health`, OpenAPI docs at `/docs`)
- Mailpit (captured emails): http://localhost:8025

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Runs every app in watch mode |
| `pnpm build` | Builds every app |
| `pnpm typecheck` | Type-checks every package |
| `pnpm test` | Runs every test suite (Vitest) |
| `pnpm lint` / `pnpm lint:fix` | Lints and checks formatting with Biome / applies fixes |
| `pnpm db:up` / `pnpm db:down` | Starts / stops Postgres and Mailpit |
| `pnpm db:generate` | Generates a migration from the Drizzle schema |
| `pnpm db:migrate` | Applies migrations |
| `pnpm db:studio` | Opens Drizzle Studio |
| `pnpm --filter @osg/api openapi` | Regenerates `apps/web/openapi.json`, the spec behind the docs' API reference (a test fails when it's out of date) |

## Coding standards

File naming (PascalCase for React components), the 300-line limit per file and other conventions
are described in [docs/coding-standards.md](docs/coding-standards.md). Most are enforced by Biome.

## Git hooks

[lefthook](https://lefthook.dev) runs Biome on staged files before each commit (fixes are re-staged
automatically), checks the commit message, and runs typecheck and tests before each push. CI runs
the same checks.

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org), checked by
[commitlint](https://commitlint.js.org) (see `commitlint.config.js`):

```
<type>(<optional scope>): <subject>

feat(api): add subscription endpoints
fix(worker): retry failed digests
docs: explain how streaks are counted
feat(api)!: rename /v1/me/feed to /v1/me/issues   ← breaking change
```

- **Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- **Scopes (optional):** `api`, `worker`, `web`, `docs`, `core`, `emails`, `db`, `deps`, `ci`, `config`, `release`

## License

[MIT](LICENSE)
