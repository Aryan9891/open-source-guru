# Coding standards

These rules apply to every package in the repository. The ones marked **(enforced)** are checked
by Biome, so they fail the pre-commit hook and CI.

## File names

| Kind of file | Convention | Examples |
|---|---|---|
| React component files (`.tsx`) **(enforced)** | PascalCase, named after the main component they export | `RepoTeaser.tsx`, `Logo.tsx`, `NotificationEmail.tsx` |
| Other modules (`.ts`): routes, services, jobs, helpers, data | kebab-case | `poll-repo.ts`, `send-notifications.ts`, `resources.ts` |
| Tests | Name of the code under test + `.test.ts`; `.integration.test.ts` when they need a database | `match.test.ts`, `polling.integration.test.ts` |
| Files whose names are fixed by a tool | As the tool requires | `page.tsx`, `layout.tsx`, `route.ts`, `icon.png`, `apple-icon.tsx`, `next.config.ts`, `vitest.config.ts`, `drizzle.config.ts`, migrations |

The PascalCase rule is enforced for `.tsx` files in `apps/web/components/`, in any `_components/`
folder under `apps/web/app/`, and in `packages/emails/src/`. Put new components there.

## File size

- **At most 300 lines per file (enforced).** When a file grows past that, split it by topic: one
  component per file, one route group per file, one test file per feature (shared test setup goes
  in `src/testing/setup.ts`).
- **Lines wrap at 100 characters.** The formatter does this for you (`pnpm lint:fix`, and the
  pre-commit hook). Only unbreakable content, like long URLs or strings, can exceed it.

## Formatting and linting

- [Biome](https://biomejs.dev) formats and lints everything: run `pnpm lint` to check and
  `pnpm lint:fix` to apply fixes. The pre-commit hook fixes staged files automatically.
- Double quotes, semicolons, trailing commas, 2-space indentation.
- Imports are sorted automatically.

## TypeScript

- Strict mode, with `noUncheckedIndexedAccess`.
- The API and worker run their `.ts` sources directly with Node (type stripping), so code must use
  only erasable syntax: no `enum`, no `namespace`, no constructor parameter properties. Use
  `import type` for type-only imports. The compiler enforces this (`erasableSyntaxOnly`,
  `verbatimModuleSyntax`).
- Relative imports include the extension: `import { buildApp } from "./app.ts"`.

## Web app routes

Never write a path by hand: import `ROUTES` from `@/lib/constants` (`ROUTES.signIn`,
`ROUTES.dashboard`…). When you add a page, add its route there first. The only exception is the
type parameter of Next.js's typed routes, e.g. `PageProps<"/sign-in">`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org), checked by commitlint. See the
README's "Commit messages" section for types and scopes.
