import { Change, EventContext } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { QueryDocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import { IRegistration } from '../santashop-core/src';

admin.initializeApp();

// eslint-disable-next-line require-jsdoc
export async function OnCreate(
  change: Change<QueryDocumentSnapshot>,
  context: EventContext
): Promise<FirebaseFirestore.WriteResult | null> {

  const registration: IRegistration = change.after.data;
  const slotId: string = registration.
  const increment = admin.firestore.FieldValue.increment(1);
  const shardIndex = Math.floor(Math.random() * 10);

  const doc = admin
    .firestore()
    .doc(`dateTimeSlots/${slotId}/shards/${shardIndex}`);

  return doc.set({ count: increment }, { merge: true });
}
