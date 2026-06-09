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

## 3. Backend-For-Frontend (BFF)
* **Environment:** Next.js API Routes.
* **Session Management:** `iron-session` (Stateless, encrypted `HttpOnly`, `Secure`, `SameSite=Strict` cookies).
* **JWT Generation:** `jose` (Zero-dependency JWT signing/verification).

## 4. Core API (`apps/core-api`)
* **Runtime:** Node.js.
* **GraphQL Server:** GraphQL Yoga or Apollo Server.
* **Architecture:** CQRS and Event Sourcing.
* **Real-time:** `graphql-ws` for WebSockets over GraphQL.

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