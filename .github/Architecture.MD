# Architecture

## 1. High-Level Component Flow
1. **Web Browser** ↔ (HTTPS/Cookies) ↔ **BFF** ↔ (GraphQL/Short-Lived JWT) ↔ **Core API**
2. **Web Browser** ↔ (WSS/Auth Ticket) ↔ **Core API** (Direct WS for Subscriptions)
3. **Core API** ↔ (Change Streams) ↔ **MongoDB** (Event Store & Projected Read Models)
4. **Shelly Pro** ↔ (WSS/JSON-RPC) ↔ **Core API** (Outbound WS for power toggling and telemetry)
5. **IoT Agent (RPi)** ↔ (WSS/Long-Lived JWT) ↔ **Core API** (Bidirectional command & status)

## 2. Security & BFF Pattern
* **No JWTs in LocalStorage:** The frontend SPA does not handle JWTs.
* **The Cookie:** The BFF issues an encrypted session cookie upon login.
* **Token Exchange:** The BFF intercepts GraphQL requests from the browser, reads the cookie, and generates a 5-minute short-lived JWT. It passes this JWT to the stateless Core API via the `Authorization` header.
* **WebSocket Auth Tickets:** For GraphQL Subscriptions, the BFF issues a 10-second "Auth Ticket". Relay uses this ticket to establish a direct WSS connection to the Core API.

## 3. CQRS & Event Sourcing
* **Write Path (Commands):** Mutations validate business rules and append Domain Events to the `events` MongoDB collection.
* **Read Path (Queries):** The GraphQL API reads from projected Read Models (e.g., `clusters`, `pipeline_runs`).
* **Projections:** A background worker listens to MongoDB Change Streams on the `events` collection to update the Read Models.

## 4. Hardware Integration (Shelly Pro)
* **Unified WebSockets:** The Shelly Pro acts as a WebSocket client, connecting to a Core API endpoint (`wss://api.internal/shelly/rpc`).
* **Separation of Telemetry vs. State:**
  * *Volatile:* 1-second power ticks are piped straight to the UI via GraphQL subscriptions. They are NOT saved to the Event Store.
  * *Persistent:* Cumulative energy (`aenergy.total`) is read at boot and shutdown. The delta is saved as a single Domain Event (`PipelineRunCompleted`) for accurate billing.

## 5. UI Information Architecture (Operator-Centric)
1. **App Shell:** Auth state, environment badge, global alerts, navigation.
2. **Clusters Overview:** Cluster status, lease count, online nodes, power snapshot.
3. **Cluster Detail Tabs:**
   * **Runs/Leases:** Acquire/renew/release flows and lifecycle transitions.
   * **Nodes:** Node roster with status, metadata, and quick actions.
   * **Power & Billing:** Node and run-level energy/cost visibility.
   * **Events:** Filterable audit stream for traceability.
4. **Node Detail:** Lifecycle, connectivity, power, billing cycle card.
5. **Provisioning Wizard:** Token generation/exchange/bootstrap walkthrough.

## 6. Relay Client Architecture (Textbook Pattern)
### 6.1 Route Query + Fragment Colocation
* Route/page owns exactly one top-level query (`usePreloadedQuery`).
* Descendant components declare fragments (`useFragment`) and receive fragment refs only.
* Parent components spread child fragments; no duplicate ad-hoc field selections.

### 6.2 Pagination and List Rendering
* All list UIs use Relay Connections (`edges`, `node`, `pageInfo`).
* Components use `usePaginationFragment` for incremental loading.
* Stable sorting is mandatory to prevent cursor drift.

### 6.3 Mutation Strategy
* Use `useMutation` with generated TypeScript operation types.
* Prefer declarative store updates (`@appendEdge`, `@prependEdge`, `@deleteEdge`) when payload allows.
* Use optimistic updates only for deterministic state transitions (e.g., immediate status badge updates).
* For non-deterministic or server-derived values, wait for authoritative payload.

### 6.4 Subscription Strategy (Live Updates)
* Keep a dedicated subscription layer using WS auth tickets from BFF.
* `useSubscription` updates read views (status changes, power ticks, lifecycle events).
* Subscription payloads must include entity identity (`id`) and timing metadata (`occurredAt`) for robust store reconciliation.

### 6.5 Error/Suspense Boundaries
* Place Suspense boundaries at route and major panel level (Clusters list, Node detail, Events feed).
* Place error boundaries around each major data region so one panel failure does not blank the entire app.

## 7. Backend GraphQL for Relay
### 7.1 N+1 Handling
* Introduce DataLoader instances per request context for common fan-out paths:
  * Node by ID
  * Cluster by ID
  * Runs by cluster
  * Recent events by aggregate
* Batch and cache within request scope only.

### 7.2 Resolver Design Rules
* Read resolvers pull from projected read models, not event replay.
* Mutations append events and return affected aggregate/root for Relay normalization.
* Subscriptions publish minimal but complete entity payloads for cache updates.

### 7.3 Relay-Safe Schema Constraints
* `Node` interface and `node(id: ID!)` are always available.
* Any pageable field is exposed as a connection.
* IDs are stable and globally unique in GraphQL layer.

## 8. UI/UX Delivery Plan (Relay-First)
### Phase 1 — Shell, Session, and Route Query Foundations
**Scope**
* App shell with auth badge, nav, and global alert region.
* Session-aware bootstrap state from BFF.
* First route-level Relay queries wired end-to-end.

**Inspectable Output**
* Refresh-safe auth state in UI.
* Stable initial load through route preloaded query.

### Phase 2 — Cluster Overview and Detail Data Flows
**Scope**
* Clusters overview with connection pagination.
* Cluster detail with co-located fragments in Runs/Leases and Nodes tabs.
* Mutation flows for acquire/renew/release lease with optimistic UI where safe.

**Inspectable Output**
* Cluster status and lease counters update immediately and settle correctly from server payload.

### Phase 3 — Node Detail, Power, and Billing Views
**Scope**
* Node detail with metadata/lifecycle cards.
* Power and billing cards using read-model queries.
* Run cost card with clear window and formula presentation.

**Inspectable Output**
* Node lifecycle, power, and cost values traceable to backend data with no manual refresh.

### Phase 4 — Live Updates and Event Feed
**Scope**
* Subscription wiring for status/power/event updates.
* Events feed with filters (cluster/node/run/type/time).
* Cache reconciliation rules for connection insertions and node status transitions.

**Inspectable Output**
* Real-time UI transitions while events occur, with consistent store state after reconnects.

### Phase 5 — Hardening and Performance
**Scope**
* Add DataLoader coverage to high-fan-out resolvers.
* Audit for query waterfalls and eliminate them.
* Add panel-level error boundaries and loading states.

**Inspectable Output**
* Reduced resolver query count in logs and resilient partial-failure behavior in UI.

## 9. Delivery Guardrails
* No direct fetch calls in feature components once Relay surfaces exist.
* Fragment ownership is mandatory for reusable components.
* Every new list design must define connection key and pagination behavior.
* Every new mutation must define expected store update behavior (declarative first, imperative only if necessary).