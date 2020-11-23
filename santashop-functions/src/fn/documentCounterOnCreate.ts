import { EventContext } from 'firebase-functions';
import { firestore } from 'firebase-admin';

const IGNORE_COLLECTIONS = ['counters', 'qrcodes', 'registrationemails'];

export default async (
  context: EventContext
  ) => {
    const collection: string = context.params.collection;

    if (IGNORE_COLLECTIONS.includes(collection)) {
      return null;
    }

    const increment = firestore.FieldValue.increment(1);
    const shardIndex = Math.floor(Math.random() * 10);

    const doc = firestore()
      .doc(`counters/${collection}/shards/${shardIndex}`);

    return doc.set({ count: increment }, { merge: true });
  };
