// Conventional Commits: https://www.conventionalcommits.org
// Format: <type>(<optional scope>): <subject>, e.g. "feat(api): add subscription endpoints"

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Scopes are optional; when present they must name a part of the monorepo.
    "scope-enum": [
      2,
      "always",
      [
        // apps and packages
        "api",
        "worker",
        "web",
        "docs",
        "core",
        "emails",
        // cross-cutting
        "db",
        "deps",
        "ci",
        "config",
        "release",
      ],
    ],
  },
};
