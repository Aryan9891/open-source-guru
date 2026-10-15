# syntax=docker/dockerfile:1
# Web image: Next.js standalone output.
# Build from the repo root: docker build -f docker/web.Dockerfile .

ARG NODE_VERSION=24.22.0-slim

FROM node:${NODE_VERSION} AS base
RUN npm install --global pnpm@12.11.2 turbo@2.11.7
WORKDIR /app

FROM base AS prune
COPY . .
RUN turbo prune @osg/web --docker

FROM base AS builder
COPY --from=prune /app/out/json/ .
# Skips the root `prepare` script (it installs git hooks and needs git), then runs the
# dependency build scripts allowed in pnpm-workspace.yaml (esbuild).
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts && pnpm rebuild
COPY --from=prune /app/out/full/ .
# The /api/* rewrites in next.config.ts are compiled into the build, so the API's address
# on the Docker network is a build argument (the runtime variable only serves server code).
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=${API_INTERNAL_URL} \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo run build --filter=@osg/web

FROM node:${NODE_VERSION} AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
# outputFileTracingRoot is the monorepo root, so the server lives under apps/web.
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
