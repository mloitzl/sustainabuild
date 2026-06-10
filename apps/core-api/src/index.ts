import { createServer } from 'http';
import { execute, subscribe } from 'graphql';
import { createYoga, createSchema } from 'graphql-yoga';
import { useServer } from 'graphql-ws/lib/use/ws';
import { WebSocketServer } from 'ws';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { connectMongo, disconnectMongo, getDb } from './db/mongo';
import { createEventStoreIndexes } from './events/store';
import { startProjector } from './projections/projector';
import { startLeaseReaper, stopLeaseReaper } from './services/lease-reaper';
import { agentRegistry } from './services/agent-registry';
import { verifyDeviceJwt } from './utils/jwt';

const PORT = Number(process.env.PORT) || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'sustainabuild';

async function main() {
  // Connect to MongoDB (non-fatal in dev if unavailable)
  try {
    await connectMongo(MONGO_URI, MONGO_DB);
    await createEventStoreIndexes();
    await startProjector();
    startLeaseReaper(getDb());
  } catch (err) {
    console.warn('[Startup] MongoDB unavailable — running without persistence:', (err as Error).message);
  }

  const schema = createSchema({ typeDefs, resolvers });

  const yoga = createYoga({
    schema,
    graphqlEndpoint: '/graphql',
    healthCheckEndpoint: '/health',
    logging: true,
    context: async (ctx) => {
      // Enrich context with agent info from WebSocket auth
      const agentInfo = (ctx as any).agentInfo;
      return {
        agentRegistry,
        db: getDb(),
        agentInfo, // { clusterId, nodeId } if authenticated as agent
      };
    },
  });

  const httpServer = createServer(yoga);

  // WebSocket server on the same port/path for graphql-ws (used by agents and frontend subscriptions)
  const wss = new WebSocketServer({ server: httpServer, path: '/graphql' });
  useServer(
    {
      schema,
      execute,
      subscribe,
      // Validate agent JWT on connection
      onConnect: async (ctx) => {
        const connectionParams = ctx.connectionParams as Record<string, any>;
        const authHeader = connectionParams?.Authorization || connectionParams?.authorization;

        if (authHeader && typeof authHeader === 'string') {
          const token = authHeader.replace(/^Bearer\s+/, '');
          try {
            const decoded = await verifyDeviceJwt(token);
            console.log(`[WebSocket] Authenticated agent: cluster=${decoded.clusterId}`);
            // Attach to context so resolvers can access it
            (ctx as any).agentInfo = decoded;
            return true; // Allow connection
          } catch (err) {
            console.warn(`[WebSocket] JWT verification failed: ${(err as Error).message}`);
            return false; // Reject connection
          }
        }

        // No auth header — allow unauthenticated connections (frontend)
        return true;
      },
    },
    wss,
  );

  httpServer.listen(PORT, () => {
    console.log(`[Core API] GraphQL server  → http://localhost:${PORT}/graphql`);
    console.log(`[Core API] WS subscriptions → ws://localhost:${PORT}/graphql`);
    console.log(`[Core API] Health check    → http://localhost:${PORT}/health`);
  });

  const shutdown = async () => {
    console.log('[Core API] Shutting down...');
    stopLeaseReaper();
    agentRegistry.clear();
    wss.close();
    httpServer.close();
    await disconnectMongo();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[Core API] Fatal startup error:', err);
  process.exit(1);
});

