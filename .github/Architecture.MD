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