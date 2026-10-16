<!--
Thanks for contributing! Please read CONTRIBUTING.md if you haven't yet.
The PR title becomes part of the history: use the Conventional Commits format,
e.g. "feat(api): add subscription endpoints".
-->

## What & why

<!-- What does this change, and what problem does it solve? -->

Closes #

## How to test

<!-- Steps a reviewer can follow locally. Mention Mailpit (http://localhost:8025) for emails. -->

1.

## Screenshots

<!-- For UI or email template changes: before / after. Delete this section otherwise. -->

## Checklist

- [ ] The change is focused on one thing, and was discussed in an issue first if it's large
- [ ] Follows the [coding standards](https://github.com/tem-ctrl/open-source-guru/blob/main/docs/coding-standards.md) (file names, 300-line
      limit, `ROUTES` for web paths, erasable TypeScript syntax only)
- [ ] Tests added or updated for behavior changes (`*.integration.test.ts` when a database is needed)
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passes locally
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)

If it applies:

- [ ] **Database schema:** migration generated with `pnpm db:generate` and committed; existing
      migrations left unchanged
- [ ] **API:** `apps/web/openapi.json` regenerated with `pnpm --filter @osg/api openapi`
- [ ] **New environment variable:** added to `.env.example` (and `.env.production.example`) and
      validated in the app's `env.ts`
- [ ] **User-facing behavior:** docs in `apps/web/content/docs/` updated

## Notes for reviewers

<!-- Context, trade-offs, follow-ups, open questions. -->
