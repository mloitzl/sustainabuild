import { createPubSub } from 'graphql-yoga';

export const pubSub = createPubSub<{
  CLUSTER_POWER_UPDATED: [clusterId: string, powerW: number];
  NODE_JOINED_CLUSTER: [clusterId: string, node: Record<string, unknown>];
}>();

const PACKAGE_VERSION = '0.1.0';

export const resolvers = {
  Query: {
    health: () => ({ ok: true, version: PACKAGE_VERSION }),

    node: (_parent: unknown, { id }: { id: string }) => {
      // TODO: Implement global node lookup via Read Models
      console.log(`[Resolver] node(${id}) — not yet implemented`);
      return null;
    },

    clusters: () => ({
      edges: [],
      pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
    }),

    cluster: (_parent: unknown, { id }: { id: string }) => {
      // TODO: Read from clusters Read Model
      console.log(`[Resolver] cluster(${id}) — not yet implemented`);
      return null;
    },
  },

  Mutation: {
    createCluster: (_parent: unknown, { name }: { name: string }) => {
      // TODO: Append ClusterCreated domain event
      console.log(`[Resolver] createCluster("${name}") — stub`);
      return {
        id: 'stub-id',
        name,
        status: 'OFFLINE',
        currentPowerW: 0,
        activeLeaseCount: 0,
        runs: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
        nodes: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
      };
    },

    acquireClusterLease: (_parent: unknown, { clusterId, runId }: { clusterId: string; runId: string }) => {
      console.log(`[Resolver] acquireClusterLease(cluster=${clusterId}, run=${runId}) — stub`);
      return {
        id: clusterId,
        name: 'stub',
        status: 'OFFLINE',
        currentPowerW: 0,
        activeLeaseCount: 1,
        runs: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
        nodes: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
      };
    },

    releaseClusterLease: (_parent: unknown, { clusterId, runId }: { clusterId: string; runId: string }) => {
      console.log(`[Resolver] releaseClusterLease(cluster=${clusterId}, run=${runId}) — stub`);
      return {
        id: clusterId,
        name: 'stub',
        status: 'OFFLINE',
        currentPowerW: 0,
        activeLeaseCount: 0,
        runs: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
        nodes: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
      };
    },

    renewClusterLease: (_parent: unknown, { clusterId, runId }: { clusterId: string; runId: string }) => {
      console.log(`[Resolver] renewClusterLease(cluster=${clusterId}, run=${runId}) — stub`);
      return {
        id: clusterId,
        name: 'stub',
        status: 'ONLINE',
        currentPowerW: 0,
        activeLeaseCount: 1,
        runs: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
        nodes: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
      };
    },

    forceShutdownCluster: (_parent: unknown, { clusterId }: { clusterId: string }) => {
      console.log(`[Resolver] forceShutdownCluster(cluster=${clusterId}) — stub`);
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

    generateProvisioningToken: (_parent: unknown, { clusterId }: { clusterId: string }) => {
      // TODO: Sign a real 1-hour JWT in business logic phase
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
