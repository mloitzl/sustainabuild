/**
 * Agent Registry
 *
 * In-memory registry of connected agents indexed by cluster and node ID.
 * Used for command routing and lifecycle tracking.
 */

import { EventEmitter } from 'events';

export interface AgentConnection {
  clusterId: string;
  nodeId: string;
  connectedAt: Date;
  subscriptionId?: string;
}

class AgentRegistryService extends EventEmitter {
  private agents: Map<string, Map<string, AgentConnection>> = new Map();

  /**
   * Add an agent connection
   */
  addAgent(clusterId: string, nodeId: string, subscriptionId?: string): AgentConnection {
    if (!this.agents.has(clusterId)) {
      this.agents.set(clusterId, new Map());
    }

    const connection: AgentConnection = {
      clusterId,
      nodeId,
      connectedAt: new Date(),
      subscriptionId,
    };

    this.agents.get(clusterId)!.set(nodeId, connection);
    this.emit('agentConnected', connection);
    console.log(`[AgentRegistry] Agent connected: ${clusterId}/${nodeId}`);
    return connection;
  }

  /**
   * Remove an agent connection
   */
  removeAgent(clusterId: string, nodeId: string): boolean {
    const clusterAgents = this.agents.get(clusterId);
    if (!clusterAgents) return false;

    const removed = clusterAgents.delete(nodeId);
    if (clusterAgents.size === 0) {
      this.agents.delete(clusterId);
    }

    if (removed) {
      this.emit('agentDisconnected', { clusterId, nodeId, disconnectedAt: new Date() });
      console.log(`[AgentRegistry] Agent disconnected: ${clusterId}/${nodeId}`);
    }
    return removed;
  }

  /**
   * Get agent connection by cluster and node ID
   */
  getAgent(clusterId: string, nodeId: string): AgentConnection | undefined {
    return this.agents.get(clusterId)?.get(nodeId);
  }

  /**
   * Get all agents for a cluster
   */
  getAgentsForCluster(clusterId: string): AgentConnection[] {
    const clusterAgents = this.agents.get(clusterId);
    return clusterAgents ? Array.from(clusterAgents.values()) : [];
  }

  /**
   * Check if an agent is connected
   */
  isAgentConnected(clusterId: string, nodeId: string): boolean {
    return this.agents.get(clusterId)?.has(nodeId) ?? false;
  }

  /**
   * Get count of agents for a cluster
   */
  countAgentsForCluster(clusterId: string): number {
    return this.agents.get(clusterId)?.size ?? 0;
  }

  /**
   * Clear all agents (for testing or shutdown)
   */
  clear(): void {
    this.agents.clear();
    console.log('[AgentRegistry] Cleared all agents');
  }

  /**
   * Get registry stats
   */
  getStats() {
    let totalAgents = 0;
    const byCluster: Record<string, number> = {};

    for (const [clusterId, nodes] of this.agents) {
      const count = nodes.size;
      totalAgents += count;
      byCluster[clusterId] = count;
    }

    return { totalAgents, byCluster };
  }
}

export const agentRegistry = new AgentRegistryService();
