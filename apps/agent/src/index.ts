import { startAgent } from './ws-client';

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('[Agent] SIGTERM received — stopping gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Agent] SIGINT received — stopping');
  process.exit(0);
});

startAgent().catch((err) => {
  console.error('[Agent] Fatal error during startup:', err);
  process.exit(1);
});
