# AI System Prompt & Hand-off Context

**Project:** Power Pipelines v2.0 (GreenOps CI/CD Manager)
**Goal:** Implement a complete rewrite of a legacy .NET/RabbitMQ application into a modern TypeScript Monorepo.
**Rule:** The legacy .NET codebase is DEPRECATED. Do not generate C# code. Use the domain concepts but implement them using the new architecture.

## 1. TECH STACK & BOUNDARIES
*   **Language:** TypeScript (Strict) across all layers.
*   **Frontend:** React, Relay, Tailwind CSS.
*   **BFF (Backend-for-Frontend):** Next.js API Routes. Handles authentication via `iron-session` (HTTPOnly, Secure, SameSite=Strict cookies). NO JWTs in LocalStorage.
*   **Core API:** Node.js, GraphQL (Yoga/Apollo) complying with Relay Server Spec.
*   **Database:** MongoDB. Used for Event Sourcing and CQRS Read Models.
*   **Hardware:** Shelly Pro (Gen 2/3) smart relays using JSON-RPC over WebSockets.
*   **Edge Agents:** Node.js binary (via `esbuild`/`pkg`).

## 2. ARCHITECTURAL DECISION RECORDS (ADRs)
* **ADR-001: BFF Security:** The browser never sees a JWT. The BFF proxies all requests and generates short-lived JWTs for internal Core API communication.
* **ADR-002: Real-time WebSockets:** To avoid BFF proxy bottlenecks, the frontend requests a 10-second Auth Ticket to open a WSS connection directly to the Core API for GraphQL Subscriptions.
* **ADR-003: Cumulative Telemetry:** 1-second power ticks are volatile and only used for UI animation. Billing relies strictly on the hardware's cumulative `aenergy.total` read at boot and shutdown.
* **ADR-004: Unified Protocol:** MQTT is explicitly removed. All edge devices (Raspberry Pis and Shelly Pro switches) communicate with the Core API via WebSockets.

## 3. GRAPHQL MENTAL MODEL (Relay)
```graphql
interface Node { id: ID! }

type Cluster implements Node { 
  id: ID!
  status: ClusterStatus!
  currentPowerW: Float!
  runs(first: Int, after: String): PipelineRunConnection! 
}

type Mutation {
  acquireClusterLease(clusterId: ID!, runId: ID!): Cluster!
  releaseClusterLease(clusterId: ID!, runId: ID!): Cluster!
  renewClusterLease(clusterId: ID!, runId: ID!): Cluster!
  forceShutdownCluster(clusterId: ID!): Cluster!
  createCluster(name: String!): Cluster!
  generateProvisioningToken(clusterId: ID!): String!
}

type Subscription {
  clusterPowerUpdated(clusterId: ID!): Float!
  nodeJoinedCluster(clusterId: ID!): Node!
}