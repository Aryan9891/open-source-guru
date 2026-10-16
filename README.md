<p align="center">
  <a href="https://open-source-guru.dev">
    <img src=".github/assets/banner.png" alt="Open Source Guru: find issues to work on, the moment they're labeled" width="100%">
  </a>
</p>

<p align="center">
  <a href="https://github.com/tem-ctrl/open-source-guru/stargazers"><img src="https://img.shields.io/github/stars/tem-ctrl/open-source-guru?style=flat&color=8F1383" alt="GitHub stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-45056E" alt="MIT License"></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-E47676" alt="PRs welcome"></a>
  <a href="https://discord.gg/PfVvJymRK"><img src="https://img.shields.io/badge/chat-Discord-5865F2?logo=discord&logoColor=white" alt="Discord"></a>
</p>

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
docs/        Contributor documentation (e.g. GitHub App setup, deployment)
```

## Local development

Everything runs on your machine: emails are captured by Mailpit and never reach a real inbox.

### Prerequisites

| Tool | Version | Check with |
|---|---|---|
| [Node.js](https://nodejs.org) | 24 or later | `node --version` |
| pnpm | 12, installed by Corepack | `corepack enable && pnpm --version` |
| [Docker](https://docs.docker.com/get-docker/) with Docker Compose | Any recent version | `docker compose version` |
| A development GitHub App | See [docs/github-app.md](docs/github-app.md) | |

Docker runs Postgres and Mailpit in development, and the integration tests use it too, through
Testcontainers.

### 1. Fork, clone and install

```bash
git clone https://github.com/<your-username>/open-source-guru.git  # your fork
cd open-source-guru
corepack enable   # uses the pnpm version pinned in package.json
pnpm install      # also installs the git hooks (lefthook)
```

### 2. Configure the environment

```bash
cp .env.example .env
```

All apps read this one `.env` file at the repository root. Fill in these values and leave the
others as they are. The `GITHUB_APP_*` values come from your development GitHub App
([docs/github-app.md](docs/github-app.md)).

| Variable | Value |
|---|---|
| `BETTER_AUTH_SECRET` | Output of `openssl rand -base64 32` |
| `EMAIL_TOKEN_SECRET` | Output of `openssl rand -base64 32` (run it again: use a different value) |
| `GITHUB_APP_ID` | The app's App ID |
| `GITHUB_APP_CLIENT_ID` | The app's Client ID |
| `GITHUB_APP_CLIENT_SECRET` | A client secret generated for the app |
| `GITHUB_APP_PRIVATE_KEY_PATH` | **Absolute** path to the app's private key. Keep it in `secrets/` (git-ignored) and print the path with `echo "$PWD/secrets/github-app.private-key.pem"` |
| `GITHUB_APP_INSTALLATION_ID` | The installation ID |

The apps check their environment at startup and list every missing or invalid variable.

### 3. Start the database and mail server

```bash
pnpm db:up        # Postgres on port 5433, Mailpit on 1025 (SMTP) and 8025 (web UI)
pnpm db:migrate   # creates the tables
```

### 4. Run the apps

```bash
pnpm dev          # web app, API and worker in watch mode
```

| Service | URL |
|---|---|
| Web app | http://localhost:3000 |
| User docs | http://localhost:3000/docs |
| API | http://localhost:4000 (health check at `/health`, OpenAPI docs at `/docs`) |
| Mailpit, where every email lands | http://localhost:8025 |

### 5. Check that everything works

1. Open http://localhost:3000, **sign in with GitHub**, and complete the onboarding.
2. In **Subscriptions**, follow the `tem-ctrl/open-source-guru` repository with the label
   `local testing`, and choose to get emails right away.
3. Wait a couple of minutes for the worker's first check of the repository. That first check only
   takes note of the existing issues, so nothing is sent.
4. Open an issue with the
   [Local testing template](https://github.com/tem-ctrl/open-source-guru/issues/new?template=local_testing.md).
   It adds the `local testing` label for you.
5. Within a few minutes, the notification email shows up in Mailpit. Then close the issue.

If the email arrives, your setup is complete.

### Running the tests

```bash
pnpm test                         # every package; Docker must be running
pnpm --filter @osg/core test      # a single package
```

Integration tests (`*.integration.test.ts`) start a throwaway Postgres container, so they don't
touch your development database.

### Stopping and resetting

```bash
pnpm db:down                      # stops Postgres and Mailpit, keeps the data
docker compose down -v            # stops them and deletes the database (then: pnpm db:up && pnpm db:migrate)
```

### Troubleshooting

| Problem | Fix |
|---|---|
| `Invalid environment variables` at startup | The message lists the variables. Check `.env` is at the repository root and the secrets are at least 32 characters long. |
| `ENOENT` for the private key | `GITHUB_APP_PRIVATE_KEY_PATH` must be an absolute path to an existing file. |
| GitHub says *"The redirect_uri is not associated with this application"* | The app's callback URL must be exactly `http://localhost:3000/api/auth/callback/github`. |
| Port 5433 is already in use | Change `POSTGRES_PORT` in `.env`, and the port in `DATABASE_URL` to match. |
| No email in Mailpit | Check the worker's output in the `pnpm dev` terminal. The repository must be public, and only issues labeled after the first check are sent. |
| `pnpm` not found, or the wrong version | Run `corepack enable`, then open a new terminal. |

Still stuck? Ask on [Discord](https://discord.gg/PfVvJymRK).

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

## Contributing

Contributions are welcome, from typo fixes to new features! Read the
[contributing guide](CONTRIBUTING.md) to get started, and look for issues labeled
[`good first issue`](https://github.com/tem-ctrl/open-source-guru/labels/good%20first%20issue).
Everyone taking part is expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

- Questions and discussion: join our [Discord server](https://discord.gg/PfVvJymRK)
- Bugs and ideas: [open an issue](https://github.com/tem-ctrl/open-source-guru/issues/new/choose)
- Security vulnerabilities: report them privately, as described in [SECURITY.md](SECURITY.md)

## License

[MIT](LICENSE)
