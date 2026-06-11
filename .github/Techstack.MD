# Technology Stack

**Project:** Power Pipelines v2.0
**Rule:** Strict adherence to TypeScript across all layers. No legacy .NET/C# code.

## 1. Monorepo & Tooling
* **Package Manager:** `pnpm` or `yarn` workspaces.
* **Build System:** Turborepo.
* **Linting/Formatting:** ESLint + Prettier (Shared configurations in `packages/config`).

## 2. Frontend (`apps/web`)
* **Framework:** Next.js (App Router or Pages Router, used as a SPA + BFF).
* **UI Library:** React.
* **Styling:** Tailwind CSS.
* **Data Fetching:** Relay (Declarative GraphQL with fragments and connections).
* **Relay Runtime:** `react-relay` + `relay-runtime`.
* **Relay Compiler:** `relay-compiler` (generated artifacts committed or CI-generated consistently).
* **Type Safety:** TypeScript + Relay generated operation/fragment types.
* **UI E2E Testing:** Playwright (`@playwright/test`) for browser-level smoke and regression checks.
* **Testing (recommended):** React Testing Library + Relay test utilities for fragment/query component tests.

## 3. Backend-For-Frontend (BFF)
* **Environment:** Next.js API Routes.
* **Session Management:** `iron-session` (Stateless, encrypted `HttpOnly`, `Secure`, `SameSite=Strict` cookies).
* **JWT Generation:** `jose` (Zero-dependency JWT signing/verification).

## 4. Core API (`apps/core-api`)
* **Runtime:** Node.js.
* **GraphQL Server:** GraphQL Yoga or Apollo Server.
* **Architecture:** CQRS and Event Sourcing.
* **Real-time:** `graphql-ws` for WebSockets over GraphQL.
* **GraphQL Batching:** Per-request DataLoader pattern for N+1 mitigation in resolver fan-out paths.

## 5. Database
* **Database:** MongoDB.
* **Event Store:** Standard collection, append-only.
* **Read Models:** Maintained via MongoDB Change Streams.
* **Time-Series (Optional):** MongoDB Time Series collections for 1-second power telemetry ticks.

## 6. Hardware & Edge (`apps/agent`)
* **Smart Switch:** Shelly Pro (Gen 2/3) using native Outbound WebSockets (JSON-RPC). *No MQTT/Mosquitto.*
* **IoT Agent:** Node.js compiled to a standalone binary via `esbuild` or `pkg` (runs on Raspberry Pi / k3s nodes).
* **OS Interaction:** `dbus-next` for unprivileged systemd integration.

## 7. Deployment
* **Containers:** Docker and Docker Compose for Core API, BFF, and MongoDB.
* **Edge Devices:** Provisioned directly on bare-metal Raspberry Pi OS via a `curl | bash` script.

## 8. Relay Delivery Standards (Textbook Best Practices)
* **Query Colocation:** Every UI component owns its fragment (`useFragment`), route/page owns only the top-level query.
* **Route Entry Strategy:** Use route-level preloaded queries (`loadQuery` / `usePreloadedQuery`) for deterministic initial render.
* **Fragment Composition:** Parent components spread child fragments instead of selecting fields ad-hoc.
* **Pagination:** Relay Connections (`@connection`) with stable sort and cursor-based pagination only.
* **Mutations:** `useMutation` with typed variables, optimistic response/updater when safe, and server payloads that include updated nodes/edges.
* **Subscriptions:** `useSubscription` for live updates; payloads should include enough identity fields (`id`, timestamps, status) for deterministic store reconciliation.
* **Store Consistency:** Prefer declarative directives (`@appendEdge`, `@prependEdge`, `@deleteEdge`) and minimal imperative updaters for complex cases only.
* **Error Boundaries:** Use React error boundaries and Suspense boundaries around query/fragment trees.
* **No Waterfalls:** Avoid nested ad-hoc fetches; all required data must be reachable through co-located fragments from a route query.
* **Auth Pattern:** Browser never stores API JWTs; BFF cookie session plus short-lived API JWT and WS auth ticket.

## 9. GraphQL Schema Requirements for Relay
* **Global Object Identification:** Implement `Node` interface and `node(id: ID!)` root field consistently.
* **Connections Everywhere Lists Exist:** Use `edges/node/pageInfo` shape for paginated collections.
* **Stable Cursor Semantics:** Cursors must be opaque and stable for a given ordering.
* **Minimal Overfetching:** Expose granular fields so fragments can stay focused.
* **Subscription Event Shape:** Include node IDs and monotonic event metadata (`occurredAt`, sequence/version where applicable).

## 10. UI Verification Baseline
* **Smoke Suite Location:** `apps/web/tests/e2e/*.spec.ts`
* **Playwright Config:** `apps/web/playwright.config.ts`
* **Primary Commands:**
  * `pnpm --filter=@sustainabuild/web run test:e2e`
  * `pnpm --filter=@sustainabuild/web run test:e2e:headed`
  * `pnpm --filter=@sustainabuild/web run test:e2e:install`
* **Minimum Required Coverage:**
  * Auth flow (sign in/out)
  * Relay dashboard render
  * Error boundary/retry path
  * Live updates ticket flow