import { startAgent } from './ws-client';

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('[Agent] SIGTERM received — beginning graceful halt sequence');
  // TODO: emit NodeHalting event to Core API before calling triggerShutdown()
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Agent] SIGINT received — stopping');
  process.exit(0);
});

startAgent();
