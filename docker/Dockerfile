# Shared by every service. Pass APP=<workspace-dir-name> to select one.
# syntax=docker/dockerfile:1

FROM oven/bun:1.2.19-slim AS build
WORKDIR /repo
ARG APP

COPY . .
# --ignore-scripts: the `prepare` hook installs git hooks, which need a git
# repo that does not exist in the build context.
RUN bun install --frozen-lockfile --ignore-scripts \
 && bunx turbo run build --filter="@monorepo/${APP}"

FROM node:22-slim AS runtime
ARG APP
ENV NODE_ENV=production
WORKDIR /repo

RUN groupadd --system app && useradd --system --gid app --home /repo app

# Workspace symlinks in node_modules point at packages/, so both come along.
COPY --from=build --chown=app:app /repo/node_modules ./node_modules
COPY --from=build --chown=app:app /repo/package.json ./package.json
COPY --from=build --chown=app:app /repo/packages ./packages
COPY --from=build --chown=app:app /repo/apps/${APP} ./apps/${APP}

USER app
WORKDIR /repo/apps/${APP}

# Node, not Bun, at runtime: Bun is the package manager only, and NestJS
# decorator/reflect-metadata behaviour is what the test suite exercises.
CMD ["node", "dist/main.js"]
