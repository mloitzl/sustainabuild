import { getDb } from '../db/mongo';

export async function startProjector(): Promise<void> {
  const db = getDb();
  const collection = db.collection('events');

  const changeStream = collection.watch([], { fullDocument: 'updateLookup' });

  changeStream.on('change', (change) => {
    if (change.operationType === 'insert' && change.fullDocument) {
      const event = change.fullDocument;
      console.log(`[Projector] New event: ${event['type']} for aggregate ${event['aggregateId']}`);
      // TODO: Route to per-aggregate-type projection handlers in business logic phase
    }
  });

  changeStream.on('error', (err) => {
    console.error('[Projector] Change stream error:', err);
  });

  console.log('[Projector] Listening to event store change stream');
}
