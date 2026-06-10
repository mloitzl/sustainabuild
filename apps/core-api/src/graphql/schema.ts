export const typeDefs = /* GraphQL */ `
  interface Node {
    id: ID!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  enum ClusterStatus {
    OFFLINE
    BOOTING
    ONLINE
    PENDING_SHUTDOWN
    SHUTTING_DOWN
  }

  type Cluster implements Node {
    id: ID!
    name: String!
    status: ClusterStatus!
    currentPowerW: Float!
    activeLeaseCount: Int!
    runs(first: Int, after: String): PipelineRunConnection!
    nodes(first: Int, after: String): ClusterNodeConnection!
  }

  type ClusterEdge {
    cursor: String!
    node: Cluster!
  }

  type ClusterConnection {
    edges: [ClusterEdge!]!
    pageInfo: PageInfo!
  }

  type PipelineRun implements Node {
    id: ID!
    clusterId: ID!
    runId: String!
    status: String!
    startedAt: String!
    completedAt: String
  }

  type PipelineRunEdge {
    cursor: String!
    node: PipelineRun!
  }

  type PipelineRunConnection {
    edges: [PipelineRunEdge!]!
    pageInfo: PageInfo!
  }

  type ClusterNode implements Node {
    id: ID!
    clusterId: ID!
    hostname: String!
    ipAddress: String!
    isOnline: Boolean!
    joinedAt: String!
  }

  type ClusterNodeEdge {
    cursor: String!
    node: ClusterNode!
  }

  type ClusterNodeConnection {
    edges: [ClusterNodeEdge!]!
    pageInfo: PageInfo!
  }

  type Health {
    ok: Boolean!
    version: String!
  }

  type ProvisioningExchange {
    deviceJwt: String!
    clusterId: ID!
  }

  type NodeConnectedEvent {
    clusterId: ID!
    nodeId: ID!
    connectedAt: String!
  }

  type ShutdownNodeCommand {
    clusterId: ID!
    nodeId: ID!
    commandId: ID!
    gracePeriodSeconds: Int!
    issuedAt: String!
  }

  type NodeHaltingEvent {
    clusterId: ID!
    nodeId: ID!
  }

  type ShutdownCommandResponse {
    clusterId: ID!
    nodeId: ID!
    commandId: ID!
    sentAt: String!
  }

  type Query {
    health: Health!
    node(id: ID!): Node
    clusters(first: Int, after: String): ClusterConnection!
    cluster(id: ID!): Cluster
  }

  type Mutation {
    createCluster(name: String!): Cluster!
    acquireClusterLease(clusterId: ID!, runId: ID!): Cluster!
    releaseClusterLease(clusterId: ID!, runId: ID!): Cluster!
    renewClusterLease(clusterId: ID!, runId: ID!): Cluster!
    forceShutdownCluster(clusterId: ID!): Cluster!
    generateProvisioningToken(clusterId: ID!): String!
    exchangeProvisioningToken(provisioningToken: String!): ProvisioningExchange!
    emitNodeConnected(clusterId: ID!, nodeId: ID!): NodeConnectedEvent!
    broadcastShutdownNode(clusterId: ID!, nodeId: ID!, gracePeriodSeconds: Int!): ShutdownCommandResponse!
    emitNodeHalting(clusterId: ID!, nodeId: ID!): NodeHaltingEvent!
  }

  type Subscription {
    clusterPowerUpdated(clusterId: ID!): Float!
    nodeJoinedCluster(clusterId: ID!): ClusterNode!
    shutdownNode(clusterId: ID!, nodeId: ID!): ShutdownNodeCommand!
  }
`;
