// Cluster

export type ClusterStatus =
  | 'OFFLINE'
  | 'BOOTING'
  | 'ONLINE'
  | 'PENDING_SHUTDOWN'
  | 'SHUTTING_DOWN';

export interface Cluster {
  id: string;
  name: string;
  status: ClusterStatus;
  currentPowerW: number;
  activeLeaseCount: number;
}

// PipelineRun

export type PipelineRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface PipelineRun {
  id: string;
  clusterId: string;
  runId: string;
  status: PipelineRunStatus;
  startedAt: Date;
  completedAt?: Date;
  energyWhStart?: number;
  energyWhEnd?: number;
}

// Node (Raspberry Pi)

export interface ClusterNode {
  id: string;
  clusterId: string;
  hostname: string;
  ipAddress: string;
  isOnline: boolean;
  joinedAt: Date;
}

// ProvisioningToken

export interface ProvisioningToken {
  clusterId: string;
  token: string;
  expiresAt: Date;
}

// Domain Events

export type DomainEventType =
  | 'ClusterCreated'
  | 'ClusterLeaseAcquired'
  | 'ClusterLeaseReleased'
  | 'ClusterLeaseRenewed'
  | 'ClusterPendingShutdownEntered'
  | 'ClusterPendingShutdownAborted'
  | 'ClusterForceShutdownStarted'
  | 'ClusterShutdownInitiated'
  | 'ClusterPoweredOn'
  | 'ClusterPoweredOff'
  | 'NodeShutdownRequested'
  | 'NodeShutdownCommandAcked'
  | 'NodeHalting'
  | 'NodeIsDown'
  | 'NodeConnected'
  | 'NodeDisconnected'
  | 'ProvisioningTokenGenerated'
  | 'NodeProvisioned'
  | 'PipelineRunStarted'
  | 'PipelineRunCompleted';

export interface DomainEvent<T = Record<string, unknown>> {
  id: string;
  type: DomainEventType;
  aggregateId: string;
  aggregateType: 'Cluster' | 'PipelineRun' | 'Node';
  payload: T;
  occurredAt: Date;
}
