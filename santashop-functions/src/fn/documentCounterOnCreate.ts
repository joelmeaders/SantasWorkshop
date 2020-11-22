import { EventContext } from 'firebase-functions';
import { firestore } from 'firebase-admin';

export default async (
  context: EventContext
  ) => {
    const collection = context.params.collection;
    const increment = firestore.FieldValue.increment(1);
    const shardIndex = Math.floor(Math.random() * 10);

    const doc = firestore()
      .doc(`counters/${collection}/shards/${shardIndex}`);

    return doc.set({ count: increment }, { merge: true });
  };
