# Business Requirements

## 1. Pipeline Overtaking (The Lease Pattern)
**Problem:** Multiple CI pipelines triggering concurrently should not cause conflicting Power On/Off commands.
* CI runners request a **Lease** (`acquireClusterLease(runId)`).
* The Cluster Aggregate tracks active leases.
* `Lease count == 1`: Turn physical power ON.
* `Lease count > 1`: Do nothing (hardware is already booting/up).
* `Lease count == 0`: Enter `PENDING_SHUTDOWN` state.
* **Grace Period:** A 3-minute timer starts when leases hit 0. If a new lease is acquired during this window, the shutdown aborts.
* **Zombie Mitigation:** Leases have expiration times. CI runners must send heartbeats (`renewClusterLease`). Expired leases are automatically released by the backend.

## 2. Shutdown Process Manager (The 5-Minute Saga)
**Problem:** k3s nodes take 5 minutes to gracefully halt. Power cannot be cut prematurely.
* **Initiation:** Saga emits `ShutdownNode` commands to all Agent WebSockets.
* **Agent Response:** Agents begin OS shutdown and emit `NodeHalting` before losing network.
* **Polling:** Core API executes asynchronous ICMP pings against all nodes.
* **Completion:** As pings fail, `NodeIsDown` events are logged. Once all nodes are offline, the Core API sends the Shelly RPC command to cut AC power.
* **Deadlock Breaker:** A 7-minute absolute timeout forces a physical power cut if nodes kernel-panic and respond to pings indefinitely.

## 3. Zero-Touch IoT Provisioning
**Problem:** Seamlessly adding a new Raspberry Pi to the cluster securely.
* **Generation:** UI requests a 1-hour `provisioning` JWT via GraphQL.
* **Execution:** User runs a bash script on the Pi: `curl -sSL ... | sudo bash -s -- --token <jwt> --cluster <id>`
* **Exchange:** Script swaps the 1-hour token for a Long-Lived Device JWT from the Core API.
* **Security:** Script creates an unprivileged user (`power-agent`) and grants D-Bus permissions for `org.freedesktop.login1.power-off`. No root access required for the running agent.
* **Activation:** `systemd` starts the agent, which connects via WSS and announces itself to the UI in real-time.

## 4. GraphQL Schema (Relay Compliance)
* Must implement the Relay `Node` interface for global identification.
* Must use Relay Connections (`edges`, `nodes`, `pageInfo`) for historical data (e.g., past pipeline runs).
* Mutations must be task-based (e.g., `forceShutdownCluster`), not CRUD.