FROM node:20-alpine AS base
ENV CI=true
RUN npm install -g pnpm@10.28.1
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/config/tsconfig/package.json packages/config/tsconfig/
COPY packages/config/prettier-config/package.json packages/config/prettier-config/
COPY packages/config/eslint-config/package.json packages/config/eslint-config/
COPY packages/types/package.json packages/types/
COPY apps/core-api/package.json apps/core-api/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/ packages/
COPY apps/core-api/ apps/core-api/
RUN pnpm --filter=@sustainabuild/types run build
RUN pnpm --filter=@sustainabuild/core-api run build

# Production image
FROM node:20-alpine AS runner
ENV CI=true
RUN npm install -g pnpm@10.28.1
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/config/tsconfig/package.json packages/config/tsconfig/
COPY packages/config/prettier-config/package.json packages/config/prettier-config/
COPY packages/config/eslint-config/package.json packages/config/eslint-config/
COPY packages/types/package.json packages/types/
COPY apps/core-api/package.json apps/core-api/

RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/packages/types/dist packages/types/dist
COPY --from=build /app/apps/core-api/dist apps/core-api/dist

WORKDIR /app/apps/core-api
ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]
