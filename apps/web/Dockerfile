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
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# Build
FROM deps AS build
COPY packages/ packages/
COPY apps/web/ apps/web/
RUN pnpm --filter=@sustainabuild/types run build
RUN pnpm --filter=@sustainabuild/web run build

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
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/packages/types/dist packages/types/dist
COPY --from=build /app/apps/web/.next apps/web/.next
COPY --from=build /app/apps/web/public apps/web/public

WORKDIR /app/apps/web
ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node_modules/.bin/next", "start"]
