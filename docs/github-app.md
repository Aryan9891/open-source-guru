# Registering the GitHub App

open-source-guru uses **one GitHub App** for two things (see PLAN.md §2 and §3):

- **Sign-in with GitHub**, using user access tokens.
- **Polling public repositories**, using an installation access token.

Create one app for development and a separate one for production, because each has its own callback URL.

## 1. Create the app

Go to **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**
(or `https://github.com/settings/apps/new`). To own it with an organization instead, use the
organization's settings.

| Field | Development | Production |
|---|---|---|
| GitHub App name | `open-source-guru-dev` (must be unique on GitHub) | `open-source-guru` |
| Homepage URL | `http://localhost:3000` | `https://<domain>` |
| Callback URL | `http://localhost:3000/api/auth/callback/github` | `https://<domain>/api/auth/callback/github` |
| Expire user authorization tokens | ✅ Checked | ✅ Checked |
| Request user authorization (OAuth) during installation | ☐ Unchecked | ☐ Unchecked |
| Enable Device Flow | ☐ Unchecked | ☐ Unchecked |
| Setup URL | Empty | Empty |
| Webhook → Active | ☐ Unchecked (we poll; we don't receive webhooks) | ☐ Unchecked |

The callback URL goes through the web app's `/api/*` rewrite to Better Auth in the API. The exact
path will be confirmed when Better Auth is set up in Phase 1a.

### Permissions

| Category | Permission | Access | Why |
|---|---|---|---|
| Repository | Metadata | Read-only (mandatory) | Repository information |
| Repository | Issues | Read-only | Polling issues and labels |
| Account | Email addresses | Read-only | The user's verified primary email for notifications |

Leave everything else at **No access**. Public data (contributions, profiles) needs no extra permission.

### Where can this GitHub App be installed?

**Only on this account.** The app is installed once, on our own account, to get an installation
token for polling. Users only *authorize* it when they sign in; they don't install it.

## 2. After creating the app

1. Note the **App ID** and **Client ID**.
2. **Generate a client secret** and copy it right away (it's only shown once).
3. **Generate a private key** (`.pem`) and store it outside the repo (`*.pem` is git-ignored).
4. **Install App** → install it on your own account, choosing *Only select repositories* and any
   single repo (installation tokens can read public repos anyway). Note the **installation ID**
   from the URL (`/settings/installations/<id>`).

## 3. Environment variables

These will be added to `.env.example` in Phase 1a, when they are first used:

```bash
GITHUB_APP_ID=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_APP_PRIVATE_KEY_PATH=./secrets/github-app.private-key.pem
GITHUB_APP_INSTALLATION_ID=
```

Never commit these values. In production they go in the server's `.env` file.
