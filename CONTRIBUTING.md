# Contributing to Open Source Guru

Thanks for your interest! **Open Source Guru** helps people find issues to work on in open-source
projects, so it's only fair that it's built in the open too. Contributions of every size are
welcome, and first-time contributors especially.

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md) in every project space.

## Ways to contribute

- **Report a bug** or **suggest a feature** with the
  [issue forms](https://github.com/tem-ctrl/open-source-guru/issues/new/choose).
- **Improve the documentation**: the user docs are MDX files in
  [`apps/web/content/docs/`](apps/web/content/docs/), and contributor docs live in [`docs/`](docs/).
  Typo fixes can go straight to a pull request.
- **Write code**: pick an issue labeled
  [`good first issue`](https://github.com/tem-ctrl/open-source-guru/labels/good%20first%20issue) or
  [`help wanted`](https://github.com/tem-ctrl/open-source-guru/labels/help%20wanted). Better yet,
  follow this repository with those labels on [Open Source Guru](https://open-source-guru.dev) itself.
- **Help others** on [Discord](https://discord.gg/PfVvJymRK), and review open pull requests.

Have a question? Ask on [Discord](https://discord.gg/PfVvJymRK) rather than opening an issue.

## Before you start coding

1. **Look for an existing issue**, or open one. For anything bigger than a small fix (a new
   feature, a new dependency, a schema change, a new API endpoint), agree on the approach in the
   issue before writing code, so your work doesn't go to waste.
2. **Comment on the issue** to say you're working on it, so two people don't do the same work. If
   you can't finish, say so: someone else can pick it up.
3. Keep the running costs in mind: the service polls the GitHub API and runs on a few euros a
   month. Changes that add many GitHub API calls per repository or per user need discussion.

## Development setup

Follow the [local development guide](README.md#local-development) in the README. It takes about 15
minutes: you need Node.js 24+, pnpm (via `corepack enable`), Docker, and your own development
GitHub App.

Then, with `pnpm dev` running:

- The web app is at http://localhost:3000 and the API at http://localhost:4000.
- Every email the app sends lands in **Mailpit** at http://localhost:8025. Nothing reaches a real
  inbox in development.
- Integration tests (`*.integration.test.ts`) start their own Postgres with Testcontainers, so
  Docker must be running for `pnpm test`.

The [repository layout](README.md#repository-layout) explains what each app and package does.

## Making changes

### Branches

Fork the repository (or, if you have write access, branch from `main`) and name your branch
`<type>/<short-description>`, using the commit types below: `feat/digest-grouping`,
`fix/streak-timezone`, `docs/api-examples`.

### Code

Read the [coding standards](docs/coding-standards.md). The essentials:

- PascalCase for React component files, kebab-case for other modules.
- At most 300 lines per file: split by topic when a file grows.
- The API and worker run TypeScript directly with Node, so use only erasable syntax (no `enum`, no
  `namespace`, no parameter properties) and include `.ts` extensions in relative imports.
- In the web app, use `ROUTES` from `@/lib/constants` instead of writing paths by hand.
- Before adding a helper or type, check whether `@osg/core` already has one.

Biome formats and lints everything. The pre-commit hook fixes staged files for you, and
`pnpm lint:fix` does it for the whole repository.

### Tests

Add or update tests for every behavior change:

- Pure logic (matching, streaks, periods, classification…) gets a unit test next to it:
  `match.ts` → `match.test.ts`.
- Anything that touches the database is an integration test: `*.integration.test.ts`, using the
  shared setup in the package's `src/testing/` folder.

### Common tasks

| You're changing… | Also do this |
|---|---|
| The database schema (`packages/core/src/db/schema/`) | Run `pnpm db:generate` and commit the new migration and snapshot. Never edit a migration that's already on `main`. |
| An API route or its schema | Run `pnpm --filter @osg/api openapi` and commit `apps/web/openapi.json` (a test fails when it's out of date). |
| The environment variables | Update `.env.example` and `.env.production.example`, and the app's `env.ts` validation. |
| User-facing behavior | Update the matching page in `apps/web/content/docs/`. |
| An email template (`packages/emails/`) | Check how it renders in Mailpit, and add a screenshot to your pull request. |
| A web page | Add its route to `ROUTES` in `apps/web/lib/constants.ts` first. |

### Commits

Commits follow [Conventional Commits](https://www.conventionalcommits.org), checked by commitlint
in the `commit-msg` hook and in CI:

```
feat(api): add subscription endpoints
fix(worker): retry failed digests
docs: explain how streaks are counted
```

See the README's [Commit messages](README.md#commit-messages) section for the allowed types and
scopes. Pull requests are merged with a merge commit, so every commit in your branch ends up in the
history: keep them meaningful, and squash "fix typo" commits before asking for review.

## Pull requests

1. Make sure `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passes. The pre-push hook
   runs typecheck and tests, and CI runs everything.
2. Open the pull request against `main` and fill in the template. Link the issue with
   `Closes #123`.
3. Keep it focused: one change per pull request. Small pull requests get reviewed faster.
4. A maintainer will review it. Answer comments with new commits rather than force-pushing during
   the review, so the changes are easy to follow.
5. Don't worry if CI fails on your first try: read the logs, and ask for help in the pull request
   or on Discord if you're stuck.

Draft pull requests are welcome if you'd like early feedback.

## Reporting security issues

Please don't open public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the project's
[MIT License](LICENSE).
