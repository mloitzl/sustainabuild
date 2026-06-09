import { createClient, Client } from 'graphql-ws';
import WebSocket from 'ws';

const CORE_API_URL = process.env.CORE_API_URL ?? 'ws://localhost:4000/graphql';
const DEVICE_JWT = process.env.DEVICE_JWT ?? '';

let client: Client;

function createWsClient(): Client {
  return createClient({
    webSocketImpl: WebSocket,
    url: CORE_API_URL,
    connectionParams: {
      Authorization: DEVICE_JWT ? `Bearer ${DEVICE_JWT}` : undefined,
    },
    retryAttempts: Infinity,
    shouldRetry: () => true,
    retryWait: async (retries) => {
      // Exponential backoff: 1s, 2s, 4s … capped at 30s
      const delay = Math.min(1000 * Math.pow(2, retries), 30_000);
      await new Promise((res) => setTimeout(res, delay));
    },
    on: {
      connected: () => {
        console.log('[Agent] Connected to Core API');
      },
      closed: (event) => {
        const code = (event as { code?: number }).code;
        console.warn(`[Agent] Disconnected (code=${code ?? 'unknown'}), retrying…`);
      },
      error: (err) => {
        console.error('[Agent] WebSocket error:', (err as Error).message ?? err);
      },
    },
  });
}

export function startAgent() {
  console.log(`[Agent] Starting — Core API: ${CORE_API_URL}`);
  client = createWsClient();

  // Subscribe to shutdown commands. graphql-ws keeps the event loop alive
  // and automatically re-subscribes after reconnection.
  client.subscribe(
    {
      query: /* GraphQL */ `
        subscription OnShutdownCommand {
          nodeJoinedCluster(clusterId: "broadcast") {
            id
            hostname
            isOnline
          }
        }
      `,
    },
    {
      next: (data) => {
        console.log('[Agent] Received command:', JSON.stringify(data));
        // TODO: route commands (ShutdownNode, etc.) in business logic phase
      },
      error: (err) => {
        console.error('[Agent] Subscription error:', (err as Error).message ?? err);
      },
      complete: () => {
        console.log('[Agent] Subscription completed — reconnecting');
        // Re-subscribe on completion
        setTimeout(startAgent, 1000);
      },
    },
  );

  console.log('[Agent] Listening for commands from Core API');
}

