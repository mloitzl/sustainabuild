import { Db } from 'mongodb';
import { getEventsByAggregate, appendEvent } from '../events/store';
import { ClusterAggregate } from '../domains/cluster';

const LEASE_TTL_MS = parseInt(process.env.LEASE_TTL_SECONDS || '3600', 10) * 1000;
const GRACE_PERIOD_MS = parseInt(process.env.GRACE_PERIOD_SECONDS || '180', 10) * 1000;
const REAPER_INTERVAL_MS = parseInt(process.env.REAPER_INTERVAL_MS || '10000', 10); // 10 seconds default

/**
 * Background service that:
 * 1. Finds expired leases and auto-releases them
 * 2. Detects when grace period expires and forces shutdown
 */
export class LeaseReaper {
  private db: Db;
  private intervalHandle?: NodeJS.Timeout;

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Start the reaper background task
   */
  start(): void {
    console.log(`[LeaseReaper] Starting with interval ${REAPER_INTERVAL_MS}ms`);
    this.intervalHandle = setInterval(() => this.tick(), REAPER_INTERVAL_MS);
  }

  /**
   * Stop the reaper
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      console.log('[LeaseReaper] Stopped');
    }
  }

  /**
   * Single reaper tick: process expired leases and grace periods
   */
  private async tick(): Promise<void> {
    try {
      // 1. Find all clusters with active leases
      const clusters = this.db.collection('clusters');
      const clusterList = await clusters.find({}).toArray();

      for (const cluster of clusterList) {
        const clusterId = String(cluster._id);

        // Load event history to reconstruct lease state
        const events = await getEventsByAggregate(clusterId);
        if (events.length === 0) continue;

        const aggregate = await ClusterAggregate.loadFromHistory(clusterId, events);
        const state = aggregate.getState();

        // Check for expired leases
        const now = new Date();
        const expiredLeaseRunIds: string[] = [];

        state.leases.forEach((lease) => {
          if (lease.expiresAt < now) {
            expiredLeaseRunIds.push(lease.runId);
          }
        });

        // Release any expired leases
        for (const runId of expiredLeaseRunIds) {
          console.log(
            `[LeaseReaper] Expiring lease ${runId} on cluster ${clusterId}`,
          );
          await appendEvent('ClusterLeaseReleased', clusterId, 'Cluster', {
            runId,
            leaseCount: state.leases.size - 1, // Will be 1 less after removal
            releasedAt: new Date(),
            reason: 'Lease expired',
          });
        }

        // Check for grace periods that have expired
        if (
          state.status === 'PENDING_SHUTDOWN' &&
          state.pendingShutdownEnteredAt
        ) {
          const graceEndsAt = new Date(
            state.pendingShutdownEnteredAt.getTime() + GRACE_PERIOD_MS,
          );
          if (now >= graceEndsAt) {
            console.log(
              `[LeaseReaper] Grace period expired for cluster ${clusterId}, forcing shutdown`,
            );
            await appendEvent(
              'ClusterForceShutdownStarted',
              clusterId,
              'Cluster',
              {
                reason: 'Grace period expired',
                startedAt: new Date(),
              },
            );
          }
        }
      }
    } catch (err) {
      console.error('[LeaseReaper] Error in tick:', err);
      // Continue on error so the reaper stays running
    }
  }
}

/**
 * Singleton instance of the reaper
 */
let leaseReaper: LeaseReaper;

export function startLeaseReaper(db: Db): void {
  leaseReaper = new LeaseReaper(db);
  leaseReaper.start();
}

export function stopLeaseReaper(): void {
  if (leaseReaper) {
    leaseReaper.stop();
  }
}
