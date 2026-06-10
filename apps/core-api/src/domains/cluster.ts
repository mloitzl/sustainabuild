import { DomainEvent } from '@sustainabuild/types';
import { appendEvent } from '../events/store';

export interface Lease {
  runId: string;
  acquiredAt: Date;
  expiresAt: Date;
}

export interface ClusterAggregateState {
  id: string;
  name: string;
  status: 'OFFLINE' | 'BOOTING' | 'ONLINE' | 'PENDING_SHUTDOWN' | 'SHUTTING_DOWN';
  leases: Map<string, Lease>;
  pendingShutdownEnteredAt?: Date;
}

/**
 * Cluster Aggregate Root
 * Manages lease lifecycle and emits domain events according to the Lease Pattern.
 *
 * Rules:
 * - leaseCount == 1 → cluster enters BOOTING/ONLINE
 * - leaseCount > 1 → do nothing (already booting/online)
 * - leaseCount == 0 → enter PENDING_SHUTDOWN with 3-minute grace period
 * - new lease during grace period → abort shutdown
 * - expired leases are auto-released by background reaper
 */

const LEASE_TTL_MS = parseInt(process.env.LEASE_TTL_SECONDS || '3600', 10) * 1000; // 1 hour default
const GRACE_PERIOD_MS = parseInt(process.env.GRACE_PERIOD_SECONDS || '180', 10) * 1000; // 3 minutes default

export class ClusterAggregate {
  private state: ClusterAggregateState;

  constructor(clusterId: string, clusterName: string) {
    this.state = {
      id: clusterId,
      name: clusterName,
      status: 'OFFLINE',
      leases: new Map(),
    };
  }

  /**
   * Load aggregate state from event history
   */
  static async loadFromHistory(clusterId: string, events: DomainEvent[]): Promise<ClusterAggregate> {
    const aggregate = new ClusterAggregate(clusterId, '');

    for (const event of events) {
      if (event.type === 'ClusterCreated') {
        aggregate.state.name = (event.payload as any).name;
        aggregate.state.status = 'OFFLINE';
      } else if (event.type === 'ClusterLeaseAcquired') {
        const { runId } = event.payload as any;
        aggregate.state.leases.set(runId, {
          runId,
          acquiredAt: event.occurredAt,
          expiresAt: new Date(event.occurredAt.getTime() + LEASE_TTL_MS),
        });
      } else if (event.type === 'ClusterLeaseReleased') {
        const { runId } = event.payload as any;
        aggregate.state.leases.delete(runId);
      } else if (event.type === 'ClusterLeaseRenewed') {
        const { runId } = event.payload as any;
        const lease = aggregate.state.leases.get(runId);
        if (lease) {
          lease.expiresAt = new Date(Date.now() + LEASE_TTL_MS);
        }
      } else if (event.type === 'ClusterPendingShutdownEntered') {
        aggregate.state.status = 'PENDING_SHUTDOWN';
        aggregate.state.pendingShutdownEnteredAt = new Date((event.payload as any).enteredAt);
      } else if (event.type === 'ClusterPendingShutdownAborted') {
        aggregate.state.status = aggregate.state.leases.size > 0 ? 'ONLINE' : 'OFFLINE';
        aggregate.state.pendingShutdownEnteredAt = undefined;
      } else if (event.type === 'ClusterForceShutdownStarted') {
        aggregate.state.status = 'SHUTTING_DOWN';
        aggregate.state.pendingShutdownEnteredAt = undefined;
      }
    }

    return aggregate;
  }

  /**
   * Acquire a new lease for a pipeline run
   * Emits ClusterLeaseAcquired and optionally ClusterPendingShutdownAborted (if grace period was active)
   */
  async acquireLease(runId: string): Promise<Array<DomainEvent<any>>> {
    const events: Array<DomainEvent<any>> = [];
    const currentLeaseCount = this.state.leases.size;

    // If in grace period, abort pending shutdown
    if (this.state.status === 'PENDING_SHUTDOWN' && this.state.pendingShutdownEnteredAt) {
      const gracePeriodEnds = new Date(this.state.pendingShutdownEnteredAt.getTime() + GRACE_PERIOD_MS);
      if (Date.now() < gracePeriodEnds.getTime()) {
        // Grace period still active; abort shutdown
        await appendEvent('ClusterPendingShutdownAborted', this.state.id, 'Cluster', {
          abortedAt: new Date(),
          reason: 'New lease acquired during grace period',
        });

        events.push({
          id: 'temp',
          type: 'ClusterPendingShutdownAborted',
          aggregateId: this.state.id,
          aggregateType: 'Cluster',
          payload: { abortedAt: new Date(), reason: 'New lease acquired during grace period' },
          occurredAt: new Date(),
        });

        this.state.status = 'ONLINE';
        this.state.pendingShutdownEnteredAt = undefined;
      }
    }

    // Add the new lease
    this.state.leases.set(runId, {
      runId,
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + LEASE_TTL_MS),
    });

    await appendEvent('ClusterLeaseAcquired', this.state.id, 'Cluster', {
      runId,
      leaseCount: this.state.leases.size,
      acquiredAt: new Date(),
    });

    events.push({
      id: 'temp',
      type: 'ClusterLeaseAcquired',
      aggregateId: this.state.id,
      aggregateType: 'Cluster',
      payload: { runId, leaseCount: this.state.leases.size, acquiredAt: new Date() },
      occurredAt: new Date(),
    });

    // Transition: 0 → 1 leases: turn power ON (BOOTING state)
    if (currentLeaseCount === 0 && this.state.leases.size === 1) {
      this.state.status = 'BOOTING';
    } else if (this.state.leases.size > 0) {
      this.state.status = 'ONLINE';
    }

    return events;
  }

  /**
   * Renew an existing lease (extend expiry)
   */
  async renewLease(runId: string): Promise<Array<DomainEvent<any>>> {
    const events: Array<DomainEvent<any>> = [];

    const lease = this.state.leases.get(runId);
    if (!lease) {
      throw new Error(`Lease not found: ${runId}`);
    }

    lease.expiresAt = new Date(Date.now() + LEASE_TTL_MS);

    await appendEvent('ClusterLeaseRenewed', this.state.id, 'Cluster', {
      runId,
      newExpiresAt: lease.expiresAt,
      renewedAt: new Date(),
    });

    events.push({
      id: 'temp',
      type: 'ClusterLeaseRenewed',
      aggregateId: this.state.id,
      aggregateType: 'Cluster',
      payload: { runId, newExpiresAt: lease.expiresAt, renewedAt: new Date() },
      occurredAt: new Date(),
    });

    return events;
  }

  /**
   * Release a lease
   * Emits ClusterLeaseReleased and optionally ClusterPendingShutdownEntered (if leases hit 0)
   */
  async releaseLease(runId: string): Promise<Array<DomainEvent<any>>> {
    const events: Array<DomainEvent<any>> = [];

    this.state.leases.delete(runId);

    await appendEvent('ClusterLeaseReleased', this.state.id, 'Cluster', {
      runId,
      leaseCount: this.state.leases.size,
      releasedAt: new Date(),
    });

    events.push({
      id: 'temp',
      type: 'ClusterLeaseReleased',
      aggregateId: this.state.id,
      aggregateType: 'Cluster',
      payload: { runId, leaseCount: this.state.leases.size, releasedAt: new Date() },
      occurredAt: new Date(),
    });

    // Transition: leases → 0: enter PENDING_SHUTDOWN with grace period
    if (this.state.leases.size === 0) {
      this.state.status = 'PENDING_SHUTDOWN';
      this.state.pendingShutdownEnteredAt = new Date();

      await appendEvent('ClusterPendingShutdownEntered', this.state.id, 'Cluster', {
        enteredAt: this.state.pendingShutdownEnteredAt,
        gracePeriodMs: GRACE_PERIOD_MS,
      });

      events.push({
        id: 'temp',
        type: 'ClusterPendingShutdownEntered',
        aggregateId: this.state.id,
        aggregateType: 'Cluster',
        payload: { enteredAt: this.state.pendingShutdownEnteredAt, gracePeriodMs: GRACE_PERIOD_MS },
        occurredAt: new Date(),
      });
    }

    return events;
  }

  getState(): ClusterAggregateState {
    return {
      ...this.state,
      leases: new Map(this.state.leases),
    };
  }

  getLeaseCount(): number {
    return this.state.leases.size;
  }

  getStatus(): string {
    return this.state.status;
  }
}
