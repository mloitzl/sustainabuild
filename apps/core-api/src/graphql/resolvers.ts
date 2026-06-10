import { createPubSub } from 'graphql-yoga';
import { ClusterAggregate } from '../domains/cluster';
import { getEventsByAggregate, appendEvent } from '../events/store';
import { getClusterProjector } from '../projections/projector';

export const pubSub = createPubSub<{
  CLUSTER_POWER_UPDATED: [clusterId: string, powerW: number];
  NODE_JOINED_CLUSTER: [clusterId: string, node: Record<string, unknown>];
}>();

const PACKAGE_VERSION = '0.1.0';

/**
 * Helper to load or create a cluster aggregate and execute a command
 */
async function executeClusterCommand(
  clusterId: string,
  command: (aggregate: ClusterAggregate) => Promise<any[]>,
): Promise<any> {
  // Load event history
  const events = await getEventsByAggregate(clusterId);

  // Load or initialize cluster
  let aggregate: ClusterAggregate;
  if (events.length === 0) {
    // New cluster
    aggregate = new ClusterAggregate(clusterId, clusterId);
  } else {
    aggregate = await ClusterAggregate.loadFromHistory(clusterId, events);
  }

  // Execute command
  await command(aggregate);

  // Wait briefly for projector to catch up, then read from read model
  // (In production, would use event versioning for consistency)
  await new Promise(resolve => setTimeout(resolve, 100));

  // Return from read model
  const projector = getClusterProjector();
  const readModel = await projector.getCluster(clusterId);

  if (!readModel) {
    // Fallback: compute from aggregate state (shouldn't happen)
    const state = aggregate.getState();
    return {
      id: state.id,
      name: state.name,
      status: state.status,
      currentPowerW: 0,
      activeLeaseCount: state.leases.size,
      runs: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
      nodes: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
    };
  }

  return {
    id: readModel._id,
    name: readModel.name,
    status: readModel.status,
    currentPowerW: readModel.currentPowerW,
    activeLeaseCount: readModel.activeLeaseCount,
    runs: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
    nodes: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
  };
}

export const resolvers = {
  Query: {
    health: () => ({ ok: true, version: PACKAGE_VERSION }),

    node: (_parent: unknown, { id }: { id: string }) => {
      // TODO: Implement global node lookup via Read Models
      console.log(`[Resolver] node(${id}) — not yet implemented`);
      return null;
    },

    clusters: async () => {
      console.log(`[Resolver] clusters()`);
      const projector = getClusterProjector();
      const clusters = await projector.getClusters();

      const edges = clusters.map((cluster) => ({
        cursor: Buffer.from(cluster._id).toString('base64'),
        node: {
          id: cluster._id,
          name: cluster.name,
          status: cluster.status,
          currentPowerW: cluster.currentPowerW,
          activeLeaseCount: cluster.activeLeaseCount,
          runs: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
          nodes: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
        },
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
        },
      };
    },

    cluster: async (_parent: unknown, { id }: { id: string }) => {
      console.log(`[Resolver] cluster(${id})`);
      const projector = getClusterProjector();
      const readModel = await projector.getCluster(id);

      if (!readModel) {
        return null;
      }

      return {
        id: readModel._id,
        name: readModel.name,
        status: readModel.status,
        currentPowerW: readModel.currentPowerW,
        activeLeaseCount: readModel.activeLeaseCount,
        runs: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
        nodes: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
      };
    },
  },

  Mutation: {
    createCluster: async (_parent: unknown, { name }: { name: string }) => {
      const clusterId = `cluster-${Date.now()}`;
      console.log(`[Resolver] createCluster("${name}") → id=${clusterId}`);

      await appendEvent('ClusterCreated', clusterId, 'Cluster', {
        name,
        createdAt: new Date(),
      });

      // Wait briefly for projector to catch up
      await new Promise(resolve => setTimeout(resolve, 100));

      const projector = getClusterProjector();
      const readModel = await projector.getCluster(clusterId);

      return {
        id: readModel?._id || clusterId,
        name: readModel?.name || name,
        status: readModel?.status || 'OFFLINE',
        currentPowerW: readModel?.currentPowerW || 0,
        activeLeaseCount: readModel?.activeLeaseCount || 0,
        runs: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
        nodes: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
      };
    },

    acquireClusterLease: async (_parent: unknown, { clusterId, runId }: { clusterId: string; runId: string }) => {
      console.log(`[Resolver] acquireClusterLease(cluster=${clusterId}, run=${runId})`);

      return executeClusterCommand(clusterId, async (aggregate) => {
        return aggregate.acquireLease(runId);
      });
    },

    releaseClusterLease: async (_parent: unknown, { clusterId, runId }: { clusterId: string; runId: string }) => {
      console.log(`[Resolver] releaseClusterLease(cluster=${clusterId}, run=${runId})`);

      return executeClusterCommand(clusterId, async (aggregate) => {
        return aggregate.releaseLease(runId);
      });
    },

    renewClusterLease: async (_parent: unknown, { clusterId, runId }: { clusterId: string; runId: string }) => {
      console.log(`[Resolver] renewClusterLease(cluster=${clusterId}, run=${runId})`);

      return executeClusterCommand(clusterId, async (aggregate) => {
        return aggregate.renewLease(runId);
      });
    },

    forceShutdownCluster: async (_parent: unknown, { clusterId }: { clusterId: string }) => {
      console.log(`[Resolver] forceShutdownCluster(cluster=${clusterId}) — stub`);
      // TODO: Implement shutdown saga
      return {
        id: clusterId,
        name: 'stub',
        status: 'SHUTTING_DOWN',
        currentPowerW: 0,
        activeLeaseCount: 0,
        runs: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
        nodes: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
      };
    },

    generateProvisioningToken: async (_parent: unknown, { clusterId }: { clusterId: string }) => {
      // TODO: Sign a real 1-hour JWT in provisioning phase
      console.log(`[Resolver] generateProvisioningToken(cluster=${clusterId}) — stub`);
      return `stub-provisioning-token-${clusterId}`;
    },
  },

  Subscription: {
    clusterPowerUpdated: {
      subscribe: (_parent: unknown, { clusterId }: { clusterId: string }) =>
        pubSub.subscribe('CLUSTER_POWER_UPDATED', clusterId),
      resolve: (payload: number) => payload,
    },
    nodeJoinedCluster: {
      subscribe: (_parent: unknown, { clusterId }: { clusterId: string }) =>
        pubSub.subscribe('NODE_JOINED_CLUSTER', clusterId),
      resolve: (payload: Record<string, unknown>) => payload,
    },
  },

  Node: {
    __resolveType() {
      return null;
    },
  },
};
