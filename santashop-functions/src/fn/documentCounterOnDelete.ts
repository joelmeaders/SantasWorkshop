import { EventContext } from 'firebase-functions';
import { firestore } from 'firebase-admin';

export default async (
  context: EventContext
  ) => {
    const IGNORE_COLLECTIONS = ['counters', 'qrcodes', 'registrationemails'];
    const collection = context.params.collection;

    if (IGNORE_COLLECTIONS.includes(collection)) {
      return null;
    }

    const decrement = firestore.FieldValue.increment(-1);
    const shardIndex = Math.floor(Math.random() * 10);

    const doc = firestore()
      .doc(`counters/${collection}/shards/${shardIndex}`);

    return doc.set({ count: decrement }, { merge: true });
  };
