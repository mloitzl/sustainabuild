import { Collection, Db, ChangeStream, ChangeStreamDocument } from 'mongodb';
import { DomainEvent } from '@sustainabuild/types';

/**
 * Node Read Model
 */
export interface NodeReadModel {
  _id: string; // nodeId#clusterId
  nodeId: string;
  clusterId: string;
  hostname: string;
  ipAddress: string;
  firmwareVersion?: string;
  status: 'PROVISIONED' | 'ONLINE' | 'OFFLINE' | 'DECOMMISSIONED';
  onlineAt?: Date;
  offlineAt?: Date;
  joinedAt: Date;
  totalEnergyWh: number;
  lastPowerW: number;
  onlineDurationSeconds: number; // cumulative
  createdAt: Date;
  updatedAt: Date;
}

export class NodeProjector {
  private db: Db;
  private nodesCollection: Collection<NodeReadModel>;
  private changeStream: ChangeStream | null = null;
  private isRunning = false;

  constructor(db: Db) {
    this.db = db;
    this.nodesCollection = db.collection('nodes');
  }

  async createIndexes(): Promise<void> {
    await this.nodesCollection.createIndex({ clusterId: 1 });
    await this.nodesCollection.createIndex({ nodeId: 1, clusterId: 1 }, { unique: true });
    await this.nodesCollection.createIndex({ status: 1 });
    await this.nodesCollection.createIndex({ updatedAt: -1 });
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    const eventStore = this.db.collection('events');

    // Get last processed event for resumption
    const lastProcessed = await this.nodesCollection.findOne({}, { sort: { updatedAt: -1 } });
    const lastProcessedTime = lastProcessed?.updatedAt || new Date(0);

    console.log('[NodeProjector] Starting with last processed at', lastProcessedTime.toISOString());

    const changeStreamPipeline = [
      {
        $match: {
          operationType: 'insert',
          'fullDocument.aggregateType': 'Node',
          'fullDocument.occurredAt': { $gte: lastProcessedTime },
        },
      },
    ];

    this.changeStream = eventStore.watch(changeStreamPipeline);

    this.changeStream.on('change', async (change: ChangeStreamDocument<any>) => {
      try {
        if ('fullDocument' in change && change.fullDocument) {
          const event = change.fullDocument as unknown as DomainEvent;
          await this.processEvent(event);
        }
      } catch (err) {
        console.error('[NodeProjector] Error processing event:', err);
      }
    });

    this.changeStream.on('error', (err) => {
      console.error('[NodeProjector] Change stream error:', err);
    });
  }

  async stop(): Promise<void> {
    if (this.changeStream) {
      await this.changeStream.close();
      this.changeStream = null;
    }
    this.isRunning = false;
  }

  private async processEvent(event: DomainEvent): Promise<void> {
    const { aggregateId, type, payload, occurredAt } = event;
    const [clusterId, nodeId] = aggregateId.split('#');

    console.log(`[NodeProjector] Processing event: ${type} for aggregate ${aggregateId}`);

    let readModel = await this.nodesCollection.findOne({ _id: aggregateId });

    if (!readModel) {
      readModel = {
        _id: aggregateId,
        nodeId,
        clusterId,
        hostname: '',
        ipAddress: '',
        firmwareVersion: undefined,
        status: 'PROVISIONED',
        joinedAt: occurredAt,
        totalEnergyWh: 0,
        lastPowerW: 0,
        onlineDurationSeconds: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    switch (type) {
      case 'NodeProvisioned': {
        const { hostname, ipAddress, firmwareVersion } = payload as any;
        readModel.hostname = hostname;
        readModel.ipAddress = ipAddress;
        readModel.firmwareVersion = firmwareVersion;
        readModel.joinedAt = occurredAt;
        break;
      }

      case 'NodeOnline': {
        readModel.status = 'ONLINE';
        readModel.onlineAt = occurredAt;
        break;
      }

      case 'NodeOffline': {
        readModel.status = 'OFFLINE';
        readModel.offlineAt = occurredAt;

        const onlineDurationSeconds = (payload as any).onlineDurationSeconds || 0;
        readModel.onlineDurationSeconds += onlineDurationSeconds;
        break;
      }

      case 'NodePowerTickRecorded': {
        const { powerW, energyWh, totalEnergyWh } = payload as any;
        readModel.lastPowerW = powerW;
        readModel.totalEnergyWh = totalEnergyWh;
        break;
      }

      case 'NodeBillingCycleClosed': {
        // Billing cycle completed, could reset here if needed
        // readModel.totalEnergyWh = 0;
        break;
      }

      default:
        return; // Ignore events we don't handle
    }

    readModel.updatedAt = new Date();

    await this.nodesCollection.updateOne({ _id: aggregateId }, { $set: readModel }, { upsert: true });
  }

  /**
   * Query: get single node by ID
   */
  async getNode(nodeId: string, clusterId: string): Promise<NodeReadModel | null> {
    return this.nodesCollection.findOne({ _id: `${clusterId}#${nodeId}` });
  }

  /**
   * Query: get all nodes in a cluster
   */
  async getNodesByCluster(clusterId: string): Promise<NodeReadModel[]> {
    return this.nodesCollection.find({ clusterId }).toArray();
  }

  /**
   * Query: get online nodes only
   */
  async getOnlineNodesByCluster(clusterId: string): Promise<NodeReadModel[]> {
    return this.nodesCollection.find({ clusterId, status: 'ONLINE' }).toArray();
  }

  /**
   * Query: get node stats (online duration, current power, total energy)
   */
  async getNodeStats(nodeId: string, clusterId: string): Promise<{
    onlineDurationSeconds: number;
    lastPowerW: number;
    totalEnergyWh: number;
    status: string;
  } | null> {
    const node = await this.getNode(nodeId, clusterId);
    if (!node) return null;

    return {
      onlineDurationSeconds: node.onlineDurationSeconds,
      lastPowerW: node.lastPowerW,
      totalEnergyWh: node.totalEnergyWh,
      status: node.status,
    };
  }

  /**
   * Query: get cluster-level power stats
   */
  async getClusterPowerStats(clusterId: string): Promise<{
    totalOnlineNodes: number;
    totalPowerW: number;
    totalEnergyWh: number;
  }> {
    const nodes = await this.getOnlineNodesByCluster(clusterId);

    return {
      totalOnlineNodes: nodes.length,
      totalPowerW: nodes.reduce((sum, n) => sum + n.lastPowerW, 0),
      totalEnergyWh: nodes.reduce((sum, n) => sum + n.totalEnergyWh, 0),
    };
  }
}

// Singleton instance
let nodeProjector: NodeProjector | null = null;

export function initNodeProjector(db: Db): NodeProjector {
  nodeProjector = new NodeProjector(db);
  return nodeProjector;
}

export function getNodeProjector(): NodeProjector {
  if (!nodeProjector) {
    throw new Error('NodeProjector not initialized');
  }
  return nodeProjector;
}
