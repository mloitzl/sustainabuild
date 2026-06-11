import { createClient, Client } from 'graphql-ws';
import WebSocket from 'ws';
import os from 'os';

const CORE_API_URL = process.env.CORE_API_URL ?? 'ws://localhost:4000/graphql';
const DEVICE_JWT = process.env.DEVICE_JWT ?? '';
const CLUSTER_ID = process.env.CLUSTER_ID ?? '';
const NODE_ID = process.env.NODE_ID ?? `node-${Date.now()}`;
const MOCK_DBUS = process.env.MOCK_DBUS === 'true';
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = Number(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS) || 300_000; // 5 minutes

function getPrimaryIpv4Address(): string | undefined {
  const interfaces = os.networkInterfaces();
  for (const records of Object.values(interfaces)) {
    if (!records) continue;
    for (const record of records) {
      if (record.family === 'IPv4' && !record.internal) {
        return record.address;
      }
    }
  }
  return undefined;
}

const AGENT_HOSTNAME = process.env.AGENT_HOSTNAME ?? os.hostname();
const AGENT_IP_ADDRESS = process.env.AGENT_IP_ADDRESS ?? getPrimaryIpv4Address() ?? '127.0.0.1';
const AGENT_FIRMWARE_VERSION = process.env.AGENT_FIRMWARE_VERSION ?? 'dev';

let client: Client;
let isConnected = false;
let isShuttingDown = false;

function createWsClient(): Client {
  return createClient({
    webSocketImpl: WebSocket,
    url: CORE_API_URL,
    connectionParams: {
      Authorization: DEVICE_JWT ? `Bearer ${DEVICE_JWT}` : undefined,
      hostname: AGENT_HOSTNAME,
      ipAddress: AGENT_IP_ADDRESS,
      firmwareVersion: AGENT_FIRMWARE_VERSION,
    },
    retryAttempts: Infinity,
    shouldRetry: () => !isShuttingDown,
    retryWait: async (retries) => {
      // Exponential backoff: 1s, 2s, 4s … capped at 30s
      const delay = Math.min(1000 * Math.pow(2, retries), 30_000);
      await new Promise((res) => setTimeout(res, delay));
    },
    on: {
      closed: (event) => {
        isConnected = false;
        const code = (event as { code?: number }).code;
        if (!isShuttingDown) {
          console.warn(`[Agent] Disconnected (code=${code ?? 'unknown'}), retrying…`);
        }
      },
      error: (err: unknown) => {
        console.error('[Agent] WebSocket error:', (err as Error).message ?? err);
      },
    },
  });
}

/**
 * Emit NodeConnected mutation to Core API
 */
async function emitNodeConnected(): Promise<void> {
  if (!client || !CLUSTER_ID || !NODE_ID) {
    console.warn('[Agent] Cannot emit NodeConnected: missing client, cluster ID, or node ID');
    return;
  }

  const hostnameLiteral = JSON.stringify(AGENT_HOSTNAME);
  const ipAddressLiteral = JSON.stringify(AGENT_IP_ADDRESS);
  const firmwareVersionLiteral = JSON.stringify(AGENT_FIRMWARE_VERSION);

  return new Promise((resolve, reject) => {
    client.subscribe(
      {
        query: `
          mutation {
            emitNodeConnected(
              clusterId: "${CLUSTER_ID}",
              nodeId: "${NODE_ID}",
              hostname: ${hostnameLiteral},
              ipAddress: ${ipAddressLiteral},
              firmwareVersion: ${firmwareVersionLiteral}
            ) {
              clusterId
              nodeId
              connectedAt
            }
          }
        `,
      },
      {
        next: (data) => {
          console.log('[Agent] NodeConnected confirmed');
          resolve();
        },
        error: (err: unknown) => {
          console.error('[Agent] Error emitting NodeConnected:', (err as Error).message ?? err);
          reject(err);
        },
        complete: () => {
          resolve();
        },
      },
    );
  });
}

/**
 * Subscribe to shutdown commands for this agent
 */
async function subscribeToShutdownCommands(): Promise<void> {
  if (!client || !CLUSTER_ID || !NODE_ID) {
    console.warn('[Agent] Cannot subscribe to shutdown commands: missing required IDs');
    return;
  }

  client.subscribe(
    {
      query: `
        subscription {
          shutdownNode(clusterId: "${CLUSTER_ID}", nodeId: "${NODE_ID}") {
            clusterId
            nodeId
            commandId
            gracePeriodSeconds
            issuedAt
          }
        }
      `,
    },
    {
      next: (data) => {
        console.log('[Agent] Received shutdown command:', JSON.stringify(data));
        const command = (data as Record<string, any>).data?.shutdownNode as Record<string, unknown>;
        if (command) {
          handleShutdownCommand(command).catch((err) => {
            console.error('[Agent] Error handling shutdown command:', err);
          });
        }
      },
      error: (err: unknown) => {
        console.error('[Agent] Shutdown subscription error:', (err as Error).message ?? err);
      },
      complete: () => {
        console.log('[Agent] Shutdown subscription completed');
        if (!isShuttingDown) {
          // Re-subscribe after a delay
          setTimeout(() => {
            subscribeToShutdownCommands().catch((err) => {
              console.error('[Agent] Error re-subscribing:', err);
            });
          }, 1000);
        }
      },
    },
  );
}

/**
 * Handle a shutdown command from Core API
 */
async function handleShutdownCommand(command: Record<string, unknown>): Promise<void> {
  const gracePeriodSeconds = (command.gracePeriodSeconds as number) ?? 300;
  const commandId = command.commandId as string;

  console.log(`[Agent] Initiating graceful shutdown (grace period: ${gracePeriodSeconds}s, command: ${commandId})`);
  isShuttingDown = true;

  // Emit NodeHalting event
  await emitNodeHalting();

  // Trigger D-Bus poweroff or mock
  await triggerShutdown(gracePeriodSeconds);
}

/**
 * Emit NodeHalting mutation to Core API
 */
async function emitNodeHalting(): Promise<void> {
  if (!client || !CLUSTER_ID || !NODE_ID) {
    console.warn('[Agent] Cannot emit NodeHalting: missing required IDs');
    return;
  }

  return new Promise((resolve) => {
    client.subscribe(
      {
        query: `
          mutation {
            emitNodeHalting(clusterId: "${CLUSTER_ID}", nodeId: "${NODE_ID}") {
              clusterId
              nodeId
            }
          }
        `,
      },
      {
        next: () => {
          console.log('[Agent] NodeHalting confirmed');
          resolve();
        },
        error: (err: unknown) => {
          console.error('[Agent] Error emitting NodeHalting:', (err as Error).message ?? err);
          resolve(); // Don't fail shutdown
        },
        complete: () => {
          resolve();
        },
      },
    );
  });
}

/**
 * Trigger system shutdown
 */
async function triggerShutdown(gracePeriodSeconds: number): Promise<void> {
  if (MOCK_DBUS) {
    console.log('[Agent] MOCK_DBUS=true → Would call D-Bus systemd poweroff');
    // Simulate shutdown with a short delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log('[Agent] Mock shutdown complete');
    process.exit(0);
  }

  // In production, trigger D-Bus
  console.log(`[Agent] Triggering D-Bus systemd poweroff (timeout: ${GRACEFUL_SHUTDOWN_TIMEOUT_MS}ms)`);

  const shutdownTimeout = setTimeout(() => {
    console.error('[Agent] Graceful shutdown timeout — forcing exit');
    process.exit(1);
  }, GRACEFUL_SHUTDOWN_TIMEOUT_MS);

  try {
    // Import dbus module (optional dependency)
    const { triggerShutdown } = await import('./dbus');
    await triggerShutdown();
    clearTimeout(shutdownTimeout);
    process.exit(0);
  } catch (err) {
    console.error('[Agent] D-Bus shutdown failed:', (err as Error).message ?? err);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

export async function startAgent(): Promise<void> {
  if (!DEVICE_JWT) {
    console.error('[Agent] DEVICE_JWT environment variable not set');
    process.exit(1);
  }

  if (!CLUSTER_ID) {
    console.error('[Agent] CLUSTER_ID environment variable not set');
    process.exit(1);
  }

  console.log(`[Agent] Starting — Core API: ${CORE_API_URL}`);
  console.log(`[Agent] Cluster: ${CLUSTER_ID}, Node: ${NODE_ID}`);
  console.log(`[Agent] Mock D-Bus: ${MOCK_DBUS}`);
  console.log(
    `[Agent] Metadata: hostname=${AGENT_HOSTNAME}, ipAddress=${AGENT_IP_ADDRESS}, firmware=${AGENT_FIRMWARE_VERSION}`,
  );

  client = createWsClient();

  // First, emit NodeConnected to establish connection
  let attempts = 0;
  const maxAttempts = 5;
  while (attempts < maxAttempts) {
    try {
      console.log(`[Agent] Attempting to connect and emit NodeConnected (attempt ${attempts + 1}/${maxAttempts})...`);
      await emitNodeConnected();
      isConnected = true;
      console.log('[Agent] Connected to Core API');
      break;
    } catch (err) {
      attempts++;
      if (attempts < maxAttempts) {
        console.warn(`[Agent] Connection attempt ${attempts} failed, retrying in 1s...`);
        await new Promise((res) => setTimeout(res, 1000));
      } else {
        console.error('[Agent] Failed to connect after', maxAttempts, 'attempts');
        process.exit(1);
      }
    }
  }

  // Subscribe to shutdown commands
  subscribeToShutdownCommands().catch((err) => {
    console.error('[Agent] Error subscribing to shutdown commands:', err);
  });

  console.log('[Agent] WebSocket client initialized — listening for commands');
}
