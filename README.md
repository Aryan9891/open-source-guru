# open-source-guru

Get email alerts when issues in open-source repos you follow are opened with, or given, labels like
"help wanted", and track your Open Source Contributions, through a web app or an API.

## Repository layout

```
apps/
  api/       Fastify REST API
  worker/    pg-boss background jobs
  web/       Next.js web app + Fumadocs docs
packages/
  core/      Shared code: environment validation, Drizzle database schema and client
docs/        Contributor documentation (e.g. GitHub App setup)
```

## Requirements

- Node.js 24 or later
- pnpm 12 (`corepack enable` picks the version from `package.json`)
- Docker with Docker Compose

## Getting started

```bash
pnpm install          # also installs the git hooks (lefthook)
cp .env.example .env
pnpm db:up            # Postgres on :5433, Mailpit on :1025 (SMTP) and :8025 (web UI)
pnpm dev              # api on :4000, worker, web on :3000
```

- Web app: http://localhost:3000 (docs at `/docs`)
- API health: http://localhost:4000/health
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
