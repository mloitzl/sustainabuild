# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SustainaBuild is a TypeScript GreenOps platform that powers k3s clusters on/off via IoT smart switches to save energy when CI runners are idle. It is a complete rewrite of a legacy .NET system — **all code is TypeScript (strict mode); never add .NET/C#.**

Deeper design docs live in `.github/`: `Architecture.MD`, `Techstack.MD`, `Requirements.MD`, `Handover.MD`, `Agent.MD`. The ADRs referenced below are in those files. `.github/copilot-instructions.md` predates the rename and still says `@power-pipelines/*` — the real workspace scope is `@sustainabuild/*`.

## Commands

pnpm + Turborepo monorepo (`pnpm@10.28.1`, Node >=20). Run from repo root:

```bash
pnpm install
pnpm build                 # turbo run build (all workspaces)
pnpm dev                   # turbo run dev --parallel (all apps)
pnpm lint                  # turbo run lint
pnpm format                # prettier --write across the repo
pnpm test                  # turbo run test

# One workspace at a time
pnpm --filter=@sustainabuild/core-api run dev
pnpm --filter=@sustainabuild/web run dev      # Next.js on :3000
```

### Web (Relay + Playwright)

```bash
# Regenerate Relay artifacts after editing any GraphQL in components.
# relay:schema builds schema.graphql from core-api typeDefs, THEN relay-compiler runs.
pnpm --filter=@sustainabuild/web run relay        # one-shot
pnpm --filter=@sustainabuild/web run relay:watch  # watch mode

pnpm --filter=@sustainabuild/web run test:e2e         # Playwright (boots dev:e2e on :3101)
pnpm --filter=@sustainabuild/web run test:e2e:headed
pnpm --filter=@sustainabuild/web run test:e2e:install # first run: install chromium

# Run a single spec / by title:
pnpm --filter=@sustainabuild/web exec playwright test tests/e2e/<file>.spec.ts
pnpm --filter=@sustainabuild/web exec playwright test -g "partial test title"
```

For UI changes, run the Playwright suite before considering the task done. Keep tests deterministic: mock unstable externals via routes, keep auth/session flows real.

### Full stack + backend E2E

```bash
docker compose up --build --detach   # mongodb (replica set), core-api (:4000), authentik, web
./scripts/e2e-local.sh               # lease lifecycle + provisioning flow (needs the stack running)
./scripts/e2e-node-billing.sh        # billing energy
./scripts/e2e-pipeline-cost.sh
./scripts/e2e-agent-bootstrap.sh
pnpm ui:guardrails:baseline          # Relay/UI guardrail checks (STRICT_RELAY_GUARDRAILS=1 for strict)
```

MongoDB **must** run as a replica set — Change Streams (used by projectors) require it; `infra/mongodb/init-replica-set.sh` handles init in compose.

## Architecture

Three apps, two shared packages (`packages/config` = ESLint/Prettier/tsconfig all apps extend; `packages/types` = shared types).

### Request / data flow
1. Browser ↔ **BFF** (`apps/web`, Next.js) ↔ **Core API** (`apps/core-api`, GraphQL Yoga on :4000).
2. The browser never sees a JWT. BFF stores an encrypted HttpOnly `iron-session` cookie. `apps/web/src/app/api/graphql/route.ts` reads the session, mints a short-lived Core-API JWT (`lib/jwt.ts`), and proxies the GraphQL request upstream — frontend Relay always hits `/api/graphql`, never Core API directly.
3. For subscriptions the browser opens a **direct** graphql-ws WebSocket to Core API using a short-TTL Auth Ticket (`/api/auth/ticket`), bypassing the BFF.
4. **Edge devices** (Shelly Pro switches via JSON-RPC, Raspberry Pi `apps/agent` via graphql-ws) connect over WebSocket only — **never MQTT or REST** (ADR-004). Agent JWTs are verified in `core-api/src/index.ts` `onConnect`.

### CQRS + Event Sourcing (core-api)
- **Event store**: append-only Mongo collection, one immutable event per doc (`events/store.ts`). Mutations are task-based commands (`acquireClusterLease`, `forceShutdownCluster`) that append events and return the affected aggregate root — not CRUD.
- **Read models**: per-domain collections kept eventually-consistent by **projectors** (`projections/*`) tailing Change Streams. Queries read only from read models.
- Aggregates: `Cluster`, `PipelineRun`, `Node`, `ProvisioningToken` (`domains/`).

### Domain rules to preserve
- **Lease pattern**: many CI runners hold leases on a cluster; power toggles only on the 0→1 and 1→0 boundaries. Test those boundaries carefully. `services/lease-reaper.ts` expires stale leases.
- **Graceful shutdown saga**: orchestrated node halt + ICMP polling before cutting AC power, with a hard timeout as a deadlock breaker.
- **Zero-touch provisioning**: a 1-hour `ProvisioningToken` JWT is exchanged for a long-lived Device JWT; the agent runs unprivileged via systemd + D-Bus (`apps/agent/src/dbus.ts`).
- **Telemetry vs billing** (ADR-003): 1-second power ticks are volatile (UI animation only); billing uses the hardware's cumulative `aenergy.total`.

### GraphQL must stay Relay-compliant
Schema is authored in `core-api/src/graphql/schema.ts`; the web app derives `schema.graphql` from it. Implement the `Node` interface and use Connections for all paginated/historical data (runs, nodes, events). After any GraphQL change in a component, rerun the `relay` script or the `__generated__` artifacts go stale.

### Auth providers (pluggable)
`apps/web/src/lib/auth/registry.ts` resolves providers from `AUTH_PROVIDERS` (comma list) or `AUTH_PROVIDER`, defaulting to `local`. Supported ids: `local`, `github`, `oidc` (`providers/*-provider.ts`). OIDC is wired to Authentik in dev (`infra/authentik/`, and the Playwright `webServer.env`).

## Required env (see `.env.example`)
`MONGO_USER`/`MONGO_PASS`, `SESSION_SECRET` (≥32 chars, iron-session), `CORE_API_JWT_SECRET` (≥32 chars, shared BFF↔Core-API JWT signing). OIDC adds `OIDC_ISSUER_URL`/`OIDC_CLIENT_ID`/`OIDC_CLIENT_SECRET`/`OIDC_PROVIDER_NAME`.

## Conventions
- Commit after each completed step with an atomic, scoped message.
- Never store JWTs in LocalStorage; the frontend only ever holds the HttpOnly cookie (ADR-001).
- WebSocket handlers must validate the ticket/JWT and clean up subscriptions on disconnect.
- Don't add MQTT or REST endpoints, or new transports, without an ADR.
