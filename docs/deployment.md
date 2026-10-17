# Deploying to the VPS

Production runs [`docker-compose.prod.yml`](../docker-compose.prod.yml) on one VPS (see PLAN.md §14),
behind the [nginx shared](#shared-nginx) with the other apps on that server.

| Service | Image | Role |
|---|---|---|
| web | `open-source-guru-web` | Next.js. Forwards `/api/*` to the api over the Docker network |
| api | `open-source-guru-backend` | Fastify + Better Auth |
| worker | `open-source-guru-backend` | pg-boss jobs |
| migrate | `open-source-guru-backend` | Applies migrations and exits; api and worker start after it succeeds |
| postgres | `postgres` | Data and job queue, on an internal network with no route out |

nginx serves `open-source-guru.dev` → web and `api.open-source-guru.dev` → api, and redirects
`www.open-source-guru.dev` → `open-source-guru.dev`. Two images are built: `backend` (api, worker
and migrate differ only by command) and `web`. Their Dockerfiles are in [`docker/`](../docker); both are built from the repo root.

## How a release works

1. A push to `main` runs the **Images** workflow, which pushes both images to GitHub Container
   Registry, tagged with the commit SHA and `latest`.
2. Deploy by hand on the VPS, from the deploy directory. Copy `docker-compose.prod.yml` there
   first if it changed. To roll back, use an older commit SHA.

   ```bash
   # Private images: log in with a GitHub token that has `read:packages`.
   docker login ghcr.io -u <github-user>
   sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=<commit-sha>/" .env
   docker compose -f docker-compose.prod.yml pull
   docker compose -f docker-compose.prod.yml up -d --remove-orphans --wait --wait-timeout 180
   docker image prune -f
   ```

   `--wait` fails if a container doesn't become healthy.

   The **Deploy** workflow (`.github/workflows/deploy.yml`) automates the same steps over SSH. It's
   turned off for now (`if: false` on its job); remove that line and set up the `production`
   environment's secrets to use it.

## Shared nginx

TLS and routing come from the nginx installed on the VPS and shared by its apps. Its configuration
lives in its own project, **vps-nginx**: this app's server blocks are in
`conf.d/open-source-guru.conf`, and its README explains how to get the certificate.

This stack publishes two ports, on 127.0.0.1 only, for nginx: web on `WEB_PORT` (default 3100)
and api on `API_PORT` (default 4100). Nothing else is reachable from the host, and nothing at all
from outside. Changing a port means changing `open-source-guru.conf` too.

## One-time server setup

The server needs Docker Engine with the Compose plugin, the [shared nginx](#shared-nginx), and a
firewall that only allows 22, 80 and 443. Docker-published ports bypass
`ufw`, which is why this stack only publishes on 127.0.0.1.

1. **DNS and certificate**: point `open-source-guru.dev`, `www.open-source-guru.dev` and
   `api.open-source-guru.dev` to the VPS (A/AAAA records), then add the site to nginx as described
   in vps-nginx's README.

2. **Deploy user**: a non-root user in the `docker` group, logging in with an SSH key used only
   for deployments:

   ```bash
   ssh-keygen -t ed25519 -f osg-deploy -C osg-deploy -N ''   # on your machine
   # On the server, append osg-deploy.pub to ~deploy/.ssh/authorized_keys
   ```

3. **Deploy directory** (default `/opt/open-source-guru`, owned by the deploy user):

   ```text
   /opt/open-source-guru/
   ├─ .env                       from .env.production.example, filled in (chmod 600)
   └─ secrets/github-app.pem     production GitHub App private key
   ```

   The containers run as the `node` user (uid 1000) and read the key as a Docker secret, so
   give that uid read access: `sudo chown 1000 secrets/github-app.pem && chmod 400 secrets/github-app.pem`.

4. **GitHub App**: use the production app from [github-app.md](github-app.md), with the callback
   URL `https://open-source-guru.dev/api/auth/callback/github`.

5. **GitHub environment**: in **Settings → Environments**, create `production` with:

   | Kind | Name | Value |
   |---|---|---|
   | Secret | `VPS_HOST` | Server hostname or IP |
   | Secret | `VPS_USER` | Deploy user |
   | Secret | `VPS_SSH_KEY` | Contents of `osg-deploy` (the private key) |
   | Secret | `VPS_KNOWN_HOSTS` | Output of `ssh-keyscan <host>`, checked against the server's real host keys |
   | Variable | `DEPLOY_PATH` | Only if not `/opt/open-source-guru` |

   Add required reviewers to the environment if deployments should be approved.

The repository is public, so its images are public too and the server could pull them without
logging in. The workflow logs in anyway with the job's `GITHUB_TOKEN`, which expires when the job
ends, so no registry credential is stored on the server.

## Operating

From the deploy directory:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api worker
docker compose -f docker-compose.prod.yml exec postgres psql -U osg osg
```

### Admins

The admin dashboard (`/admin-dashboard`) is only open to users with the admin role. To create the
first admin, set `ADMIN_LOGINS` in `.env` to your GitHub login and restart the API: the account
gets the role at startup, or on its first sign-in. Grant the role to others from
**Admin → Users**; admins can't change their own role, so there is always at least one. Removing
a login from `ADMIN_LOGINS` doesn't remove the role: do it from the dashboard. Once the first
admin exists, you can empty `ADMIN_LOGINS` (a GitHub login can be renamed and taken by someone
else).

Logs are rotated by Docker (5 × 10 MB per container).

Backups aren't set up yet: PLAN.md §14 calls for daily `pg_dump` to off-server object storage.
