import { getDb } from '../db/mongo';
import { ClusterReadModelProjector } from './cluster-projector';
import { DomainEvent } from '@sustainabuild/types';

let clusterProjector: ClusterReadModelProjector;

export async function startProjector(): Promise<void> {
  const db = getDb();

  // Initialize projectors
  clusterProjector = new ClusterReadModelProjector(db);
  await clusterProjector.initialize();

  const collection = db.collection('events');

  const changeStream = collection.watch([], { fullDocument: 'updateLookup' });

  changeStream.on('change', async (change) => {
    if (change.operationType === 'insert' && change.fullDocument) {
      const fullDocument = change.fullDocument as any;
      const event: DomainEvent<any> = {
        id: fullDocument._id.toHexString(),
        type: fullDocument.type,
        aggregateId: fullDocument.aggregateId,
        aggregateType: fullDocument.aggregateType,
        payload: fullDocument.payload,
        occurredAt: fullDocument.occurredAt,
      };

      console.log(`[Projector] New event: ${event.type} for aggregate ${event.aggregateId}`);

      try {
        // Route to appropriate projector based on aggregate type
        if (event.aggregateType === 'Cluster') {
          await clusterProjector.projectEvent(event);
        }
        // TODO: Add other aggregate projectors (Node, PipelineRun, etc.)
      } catch (err) {
        console.error(`[Projector] Error projecting event ${event.type}:`, err);
      }
    }
  });

  changeStream.on('error', (err) => {
    console.error('[Projector] Change stream error:', err);
  });

  console.log('[Projector] Listening to event store change stream with read model projections');
}

/**
 * Get the cluster projector (for read model queries)
 */
export function getClusterProjector(): ClusterReadModelProjector {
  if (!clusterProjector) {
    throw new Error('Projector not initialized. Call startProjector() first.');
  }
  return clusterProjector;
}
