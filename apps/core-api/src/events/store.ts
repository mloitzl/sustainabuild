import { Collection, ObjectId } from 'mongodb';
import { DomainEvent, DomainEventType } from '@sustainabuild/types';
import { getDb } from '../db/mongo';

type StoredEvent = Omit<DomainEvent, 'id' | 'occurredAt'> & {
  _id?: ObjectId;
  occurredAt: Date;
};

function getCollection(): Collection<StoredEvent> {
  return getDb().collection<StoredEvent>('events');
}

export async function appendEvent<T extends Record<string, unknown>>(
  type: DomainEventType,
  aggregateId: string,
  aggregateType: DomainEvent['aggregateType'],
  payload: T,
): Promise<string> {
  const collection = getCollection();
  const result = await collection.insertOne({
    type,
    aggregateId,
    aggregateType,
    payload,
    occurredAt: new Date(),
  });
  return result.insertedId.toHexString();
}

export async function getEventsByAggregate(aggregateId: string): Promise<DomainEvent[]> {
  const collection = getCollection();
  const docs = await collection.find({ aggregateId }).sort({ occurredAt: 1 }).toArray();
  return docs.map((doc) => ({
    id: doc._id!.toHexString(),
    type: doc.type,
    aggregateId: doc.aggregateId,
    aggregateType: doc.aggregateType,
    payload: doc.payload,
    occurredAt: doc.occurredAt,
  }));
}

export async function createEventStoreIndexes(): Promise<void> {
  const collection = getCollection();
  await collection.createIndex({ aggregateId: 1, occurredAt: 1 });
  await collection.createIndex({ type: 1 });
  console.log('[EventStore] Indexes created');
}
