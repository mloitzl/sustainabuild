import { Db, Collection } from 'mongodb';
import { DomainEvent } from '@sustainabuild/types';

export interface ClusterReadModel {
  _id: string;
  name: string;
  status: 'OFFLINE' | 'BOOTING' | 'ONLINE' | 'PENDING_SHUTDOWN' | 'SHUTTING_DOWN';
  activeLeaseCount: number;
  currentPowerW: number;
  pendingShutdownEnteredAt?: Date;
  gracePeriodMs?: number;
  updatedAt: Date;
}

export class ClusterReadModelProjector {
  private clustersCollection: Collection<ClusterReadModel>;

  constructor(db: Db) {
    this.clustersCollection = db.collection<ClusterReadModel>('clusters');
  }

  async initialize(): Promise<void> {
    await this.clustersCollection.createIndex({ _id: 1 });
    console.log('[ClusterProjector] Indexes created');
  }

  /**
   * Project domain events into the clusters read model
   */
  async projectEvent(event: DomainEvent<any>): Promise<void> {
    // Only project Cluster aggregate events
    if (event.aggregateType !== 'Cluster') {
      return;
    }

    const clusterId = event.aggregateId;

    switch (event.type) {
      case 'ClusterCreated':
        await this.clustersCollection.updateOne(
          { _id: clusterId },
          {
            $set: {
              _id: clusterId,
              name: event.payload.name,
              status: 'OFFLINE',
              activeLeaseCount: 0,
              currentPowerW: 0,
              updatedAt: event.occurredAt,
            },
          },
          { upsert: true },
        );
        console.log(`[ClusterProjector] ClusterCreated: ${clusterId}`);
        break;

      case 'ClusterLeaseAcquired': {
        const { leaseCount } = event.payload;
        // Transition 0→1 leases: enter BOOTING
        const newStatus = leaseCount === 1 ? 'BOOTING' : 'ONLINE';

        await this.clustersCollection.updateOne(
          { _id: clusterId },
          {
            $set: {
              activeLeaseCount: leaseCount,
              status: newStatus,
              updatedAt: event.occurredAt,
            },
          },
          { upsert: true },
        );
        console.log(`[ClusterProjector] ClusterLeaseAcquired: ${clusterId}, leaseCount=${leaseCount}, status=${newStatus}`);
        break;
      }

      case 'ClusterLeaseReleased': {
        const { leaseCount } = event.payload;
        // Determine status: if 0 leases, will be PENDING_SHUTDOWN (set by next event)
        // For now, stay at current status and let the next event set it
        await this.clustersCollection.updateOne(
          { _id: clusterId },
          {
            $set: {
              activeLeaseCount: leaseCount,
              updatedAt: event.occurredAt,
            },
          },
          { upsert: true },
        );
        console.log(`[ClusterProjector] ClusterLeaseReleased: ${clusterId}, leaseCount=${leaseCount}`);
        break;
      }

      case 'ClusterLeaseRenewed':
        await this.clustersCollection.updateOne(
          { _id: clusterId },
          {
            $set: {
              updatedAt: event.occurredAt,
            },
          },
          { upsert: true },
        );
        console.log(`[ClusterProjector] ClusterLeaseRenewed: ${clusterId}`);
        break;

      case 'ClusterPendingShutdownEntered': {
        const { enteredAt, gracePeriodMs } = event.payload;
        await this.clustersCollection.updateOne(
          { _id: clusterId },
          {
            $set: {
              status: 'PENDING_SHUTDOWN',
              pendingShutdownEnteredAt: new Date(enteredAt),
              gracePeriodMs,
              updatedAt: event.occurredAt,
            },
          },
          { upsert: true },
        );
        console.log(`[ClusterProjector] ClusterPendingShutdownEntered: ${clusterId}`);
        break;
      }

      case 'ClusterPendingShutdownAborted':
        await this.clustersCollection.updateOne(
          { _id: clusterId },
          {
            $unset: {
              pendingShutdownEnteredAt: '',
              gracePeriodMs: '',
            },
            $set: {
              status: 'ONLINE',
              updatedAt: event.occurredAt,
            },
          },
          { upsert: true },
        );
        console.log(`[ClusterProjector] ClusterPendingShutdownAborted: ${clusterId}`);
        break;

      default:
        // Ignore other event types
        break;
    }
  }

  /**
   * Query a single cluster by ID
   */
  async getCluster(clusterId: string): Promise<ClusterReadModel | null> {
    return this.clustersCollection.findOne({ _id: clusterId });
  }

  /**
   * Query all clusters
   */
  async getClusters(): Promise<ClusterReadModel[]> {
    return this.clustersCollection.find({}).toArray();
  }

  /**
   * Get the collection for direct access
   */
  getCollection(): Collection<ClusterReadModel> {
    return this.clustersCollection;
  }
}
