# Copilot Instructions for Power Pipelines v2.0

**Read first:** `.github/Agent.MD`, `Architecture.MD`, `Techstack.MD`, `Requirements.MD`, `Handover.MD`

This is a complete TypeScript rewrite of a legacy .NET GreenOps infrastructure (power management for k3s clusters via IoT smart switches).

## Build, Test, and Lint

**Workspace manager:** `pnpm` or `yarn` with Turborepo

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm exec turbo run build

# Lint all packages (ESLint + Prettier)
pnpm exec turbo run lint
pnpm exec turbo run format

# Run tests (when added to apps)
pnpm exec turbo run test

# Run web Playwright smoke tests
pnpm --filter=@sustainabuild/web run test:e2e
pnpm --filter=@sustainabuild/web run test:e2e:headed

# Run a single app/package
pnpm --filter=@power-pipelines/core-api run build
pnpm --filter=@power-pipelines/web run dev
```

**Monorepo structure:**
- `apps/core-api` — GraphQL API (Node.js)
- `apps/web` — Next.js BFF + SPA frontend
- `apps/agent` — IoT agent (standalone binary for Raspberry Pi)
- `packages/config` — Shared ESLint, Prettier, TypeScript configs
- `packages/types` — Shared type definitions

## High-Level Architecture

### Component Flow
1. **Web Browser** ↔ BFF (Next.js) ↔ Core API (GraphQL)
2. **BFF** issues encrypted HttpOnly cookies; proxies short-lived JWTs to Core API
3. **Frontend** opens direct WebSocket to Core API for subscriptions using 10-second Auth Tickets
4. **Core API** listens to MongoDB Change Streams to update Read Models from Domain Events
5. **Hardware** — Shelly Pro switches + Raspberry Pi agents connect via WebSocket (JSON-RPC and GraphQL-WS)

### Key Patterns
- **CQRS + Event Sourcing:** Domain events append to MongoDB `events` collection; Read Models update via Change Streams
- **Lease Pattern:** Multiple CI runners request leases; power only toggles when lease count crosses 0→1 or 1→0
- **Graceful Shutdown Saga:** 5-minute orchestrated node halt + ICMP polling before cutting AC power (7-minute timeout as deadlock breaker)
- **Zero-Touch Provisioning:** 1-hour JWT exchanged for long-lived Device JWT; agent runs unprivileged via systemd + D-Bus

## Key Conventions

### TypeScript & Code Organization
- **No .NET/C# code.** All TypeScript (strict mode).
- Shared configs in `packages/config` — all apps extend the same ESLint, Prettier, tsconfig
- Relay compliance required for GraphQL schema (implement `Node` interface, use Connections for paginated data)

### Authentication & Security (ADR-001)
- **Never store JWTs in LocalStorage.** Frontend sees only HttpOnly cookies.
- BFF intercepts GraphQL requests, reads cookie, generates 5-minute short-lived JWTs for Core API
- WebSocket Auth Tickets (10-second TTL) for direct subscriptions to avoid BFF bottleneck

### Database (MongoDB)
- **Event Store:** Standard collection, append-only. One event = one document with timestamp, type, aggregateId, payload
- **Read Models:** Separate collections per domain (e.g., `clusters`, `pipeline_runs`, `nodes`), updated via Change Streams
- **Telemetry:** 1-second power ticks are volatile (UI animation only); billing uses hardware's cumulative `aenergy.total` (ADR-003)

### WebSocket Protocol (ADR-004)
- **Unified:** All edge devices (Shelly Pro, Raspberry Pis) connect via WebSocket, not MQTT
- Shelly Pro: JSON-RPC over WSS at `wss://api.internal/shelly/rpc`
- Agents: GraphQL-WS for command/status + lifecycle events

### GraphQL Mutations
- Task-based mutations (e.g., `acquireClusterLease`, `forceShutdownCluster`), not CRUD
- Return the affected aggregate root, not a generic response type

### Naming
- Aggregates: `Cluster`, `PipelineRun`, `Node`
- Events: `ClusterLeasedAcquired`, `NodeShutdownRequested`, `NodeIsDown`
- Queries: read from Read Models (stateless)
- Mutations: commands that trigger Domain Events (eventually update Read Models)

## Useful References

- **Initial scaffolding order** (from Agent.MD):
  1. Turborepo + shared ESLint/Prettier/TSConfig in `packages/config`
  2. `apps/core-api` with GraphQL Yoga, MongoDB, base CQRS Event Store
  3. `apps/web` with Next.js, `iron-session`, Relay environment
  4. `apps/agent` with WebSocket client, `dbus-next` for systemd integration

- **Domain Model** (from Handover.MD):
  - `Cluster` — aggregates leases, tracks power state, emits shutdown sagas
  - `PipelineRun` — represents CI execution, acquires/releases leases
  - `Node` — represents Raspberry Pi, tracks online/offline, billing energy
  - `ProvisioningToken` — 1-hour JWT for zero-touch provisioning

## When Working in This Repo

- Read existing requirement docs before scaffolding features
- Always implement Relay Connections for historical data (runs, nodes, events)
- Ensure Domain Events are immutable; Read Model updates are eventual consistent
- WebSocket handlers must validate auth tickets/JWTs and clean up subscriptions on disconnect
- Add GraphQL `@auth` directives or check resolvers for permission guards
- Test lease acquisition/release logic thoroughly (boundary cases at 0→1 and 1→0)
- For UI changes, run the Playwright smoke suite in `apps/web/tests/e2e` before considering the task done
- Keep Playwright tests deterministic (prefer route mocks for unstable externals and keep auth/session flows real)
- Never add MQTT or REST endpoints without ADR discussion
