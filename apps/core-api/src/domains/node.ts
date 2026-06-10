import { DomainEvent } from '@sustainabuild/types';
import { appendEvent } from '../events/store';

export interface NodeAggregateState {
  id: string;
  nodeId: string;
  clusterId: string;
  hostname: string;
  ipAddress: string;
  status: 'PROVISIONED' | 'ONLINE' | 'OFFLINE' | 'DECOMMISSIONED';
  onlineAt?: Date;
  offlineAt?: Date;
  joinedAt: Date;
  totalEnergyWh: number;
  lastPowerW: number;
}

/**
 * Node Aggregate Root
 * Represents a Raspberry Pi agent in the cluster.
 *
 * State Transitions:
 * - PROVISIONED: Initial state after device JWT exchange
 * - ONLINE: Agent connected and NodeConnected event received
 * - OFFLINE: Agent disconnected or graceful shutdown completed
 * - DECOMMISSIONED: Node permanently removed from cluster
 */
export class NodeAggregate {
  private state: NodeAggregateState;

  constructor(nodeId: string, clusterId: string, hostname: string, ipAddress: string) {
    this.state = {
      id: `${clusterId}#${nodeId}`,
      nodeId,
      clusterId,
      hostname,
      ipAddress,
      status: 'PROVISIONED',
      joinedAt: new Date(),
      totalEnergyWh: 0,
      lastPowerW: 0,
    };
  }

  /**
   * Load aggregate state from event history
   */
  static async loadFromHistory(
    nodeId: string,
    clusterId: string,
    events: DomainEvent[],
  ): Promise<NodeAggregate> {
    const aggregate = new NodeAggregate(nodeId, clusterId, '', '');

    for (const event of events) {
      if (event.type === 'NodeProvisioned') {
        const { hostname, ipAddress } = event.payload as any;
        aggregate.state.hostname = hostname;
        aggregate.state.ipAddress = ipAddress;
        aggregate.state.joinedAt = event.occurredAt;
      } else if (event.type === 'NodeOnline') {
        aggregate.state.status = 'ONLINE';
        aggregate.state.onlineAt = event.occurredAt;
      } else if (event.type === 'NodeOffline') {
        aggregate.state.status = 'OFFLINE';
        aggregate.state.offlineAt = event.occurredAt;
      } else if (event.type === 'NodePowerTickRecorded') {
        const { powerW, energyWh } = event.payload as any;
        aggregate.state.lastPowerW = powerW;
        aggregate.state.totalEnergyWh += energyWh || 0;
      } else if (event.type === 'NodeBillingCycleClosed') {
        // Billing cycle closed, could reset totalEnergyWh here if needed
      }
    }

    return aggregate;
  }

  getState(): NodeAggregateState {
    return { ...this.state };
  }

  /**
   * Agent connected: transition from PROVISIONED to ONLINE
   */
  async onNodeConnected(): Promise<void> {
    if (this.state.status === 'PROVISIONED' || this.state.status === 'OFFLINE') {
      this.state.status = 'ONLINE';
      this.state.onlineAt = new Date();

      await appendEvent('NodeOnline' as any, this.state.id, 'Node', {
        nodeId: this.state.nodeId,
        clusterId: this.state.clusterId,
        onlineAt: this.state.onlineAt,
      });
    }
  }

  /**
   * Agent disconnected or graceful shutdown: transition to OFFLINE
   */
  async onNodeOffline(): Promise<void> {
    if (this.state.status === 'ONLINE') {
      this.state.status = 'OFFLINE';
      this.state.offlineAt = new Date();

      const onlineDurationMs =
        (this.state.offlineAt.getTime() - (this.state.onlineAt?.getTime() || 0)) / 1000;

      await appendEvent('NodeOffline' as any, this.state.id, 'Node', {
        nodeId: this.state.nodeId,
        clusterId: this.state.clusterId,
        offlineAt: this.state.offlineAt,
        onlineDurationSeconds: onlineDurationMs,
      });
    }
  }

  /**
   * Record power tick from Shelly Pro (1-second sample)
   */
  async recordPowerTick(powerW: number, energyWh: number): Promise<void> {
    this.state.lastPowerW = powerW;
    this.state.totalEnergyWh += energyWh;

    await appendEvent('NodePowerTickRecorded' as any, this.state.id, 'Node', {
      nodeId: this.state.nodeId,
      clusterId: this.state.clusterId,
      powerW,
      energyWh,
      totalEnergyWh: this.state.totalEnergyWh,
    });
  }

  /**
   * Close billing cycle: aggregate total energy and calculate cost
   */
  async closeBillingCycle(costPerKwh: number): Promise<number> {
    const totalKwh = this.state.totalEnergyWh / 1000;
    const cost = totalKwh * costPerKwh;

    await appendEvent('NodeBillingCycleClosed' as any, this.state.id, 'Node', {
      nodeId: this.state.nodeId,
      clusterId: this.state.clusterId,
      totalEnergyWh: this.state.totalEnergyWh,
      totalKwh,
      costPerKwh,
      totalCost: cost,
    });

    // Reset for next cycle
    this.state.totalEnergyWh = 0;

    return cost;
  }

  /**
   * Decommission node
   */
  async decommission(): Promise<void> {
    this.state.status = 'DECOMMISSIONED';
    this.state.offlineAt = new Date();

    await appendEvent('NodeOffline' as any, this.state.id, 'Node', {
      nodeId: this.state.nodeId,
      clusterId: this.state.clusterId,
      offlineAt: this.state.offlineAt,
      reason: 'decommissioned',
    });
  }
}
