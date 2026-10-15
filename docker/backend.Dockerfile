# syntax=docker/dockerfile:1
# Backend image, shared by the `api`, `worker` and `migrate` services: they only differ by command.
# Build from the repo root: docker build -f docker/backend.Dockerfile .
#
# Node runs the .ts sources directly (type stripping), and it refuses to strip types under
# node_modules. So the image keeps the workspace layout (packages/core/src stays a real folder,
# linked from node_modules) instead of using `pnpm deploy`, which copies packages into node_modules.

ARG NODE_VERSION=24.22.0-slim

FROM node:${NODE_VERSION} AS base
RUN npm install --global pnpm@12.11.2 turbo@2.11.7
WORKDIR /app

# Partial monorepo with only the packages the api and worker need.
FROM base AS prune
COPY . .
RUN turbo prune @osg/api @osg/worker --docker

# Builds @osg/emails (the only package with a build step).
FROM base AS builder
COPY --from=prune /app/out/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts
COPY --from=prune /app/out/full/ .
COPY tsconfig.base.json ./
RUN pnpm turbo run build --filter=@osg/api... --filter=@osg/worker...

# Production dependencies only. No install script is needed at runtime.
FROM base AS deps
COPY --from=prune /app/out/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:${NODE_VERSION} AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/ ./
COPY --from=prune /app/out/full/ ./
COPY --from=builder /app/packages/emails/dist ./packages/emails/dist
USER node
EXPOSE 4000
# The worker and migrate services override this command.
CMD ["node", "apps/api/src/server.ts"]
