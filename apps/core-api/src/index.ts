import { createServer } from 'http';
import { createYoga, createSchema } from 'graphql-yoga';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { connectMongo, disconnectMongo } from './db/mongo';
import { createEventStoreIndexes } from './events/store';
import { startProjector } from './projections/projector';

const PORT = Number(process.env.PORT) || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'sustainabuild';

async function main() {
  // Connect to MongoDB (non-fatal in dev if unavailable)
  try {
    await connectMongo(MONGO_URI, MONGO_DB);
    await createEventStoreIndexes();
    await startProjector();
  } catch (err) {
    console.warn('[Startup] MongoDB unavailable — running without persistence:', (err as Error).message);
  }

  const schema = createSchema({ typeDefs, resolvers });

  const yoga = createYoga({
    schema,
    graphqlEndpoint: '/graphql',
    healthCheckEndpoint: '/health',
    logging: true,
  });

  // graphql-yoga handles both HTTP and WebSocket (SSE) subscriptions natively
  const httpServer = createServer(yoga);

  httpServer.listen(PORT, () => {
    console.log(`[Core API] GraphQL server running at http://localhost:${PORT}/graphql`);
    console.log(`[Core API] Health check at         http://localhost:${PORT}/health`);
  });

  const shutdown = async () => {
    console.log('[Core API] Shutting down...');
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

