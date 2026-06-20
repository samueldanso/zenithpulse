FROM oven/bun:1.3-slim AS base

FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/server/package.json packages/server/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile --production

FROM base AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/server/package.json packages/server/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/

FROM base AS runtime
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/packages/server ./packages/server
COPY package.json ./

ENV NODE_ENV=production
ENV DB_PATH=/data/zenithpulse.db
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "const r = await fetch('http://localhost:3001/api/health'); process.exit(r.ok ? 0 : 1)"

CMD ["bun", "run", "packages/server/src/index.ts"]
