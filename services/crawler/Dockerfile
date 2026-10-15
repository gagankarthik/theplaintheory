# syntax=docker/dockerfile:1.7
#
# Plain Theory crawler image (ECS Fargate). Build context = repository root, because the worker
# bundles the dashboard's own modules from src/lib (tracker database, classifier, store):
#
#   DOCKER_BUILDKIT=1 docker build -f services/crawler/Dockerfile -t pt-crawler .
#
# BuildKit reads services/crawler/Dockerfile.dockerignore, which keeps the context small.

########## build ##########
FROM node:24-bookworm-slim AS build
WORKDIR /repo
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY services/crawler/package.json services/crawler/package-lock.json services/crawler/
RUN cd services/crawler && npm ci --no-audit --no-fund

COPY src/lib src/lib
COPY services/crawler services/crawler
RUN cd services/crawler && npx tsup

########## runtime ##########
FROM node:24-bookworm-slim AS runtime

# Debian's Chromium plus fonts so pages render as they do for visitors; tini reaps zombie Chrome processes.
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-color-emoji fonts-noto-cjk ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    STORE_DRIVER=dynamodb \
    TMPDIR=/tmp \
    HOME=/tmp \
    XDG_CONFIG_HOME=/tmp/.config \
    XDG_CACHE_HOME=/tmp/.cache

WORKDIR /app
COPY --from=build /repo/services/crawler/package.json /repo/services/crawler/package-lock.json ./
# Only puppeteer is loaded at runtime (everything else is in the bundle); --omit=dev keeps it lean.
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /repo/services/crawler/dist ./dist

# Runs with a read-only root filesystem on ECS (crawler-stack.ts): /tmp is the only writable path, so
# Chromium's profile, shared memory, caches and HOME all live there (see src/scanner/browser.ts).
USER node
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "--enable-source-maps", "dist/index.js"]
