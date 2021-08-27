import { Change, EventContext } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { QueryDocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import { IRegistration } from '../../../santashop-core/src';

admin.initializeApp();

export default async (
  change: Change<QueryDocumentSnapshot>,
  context: EventContext
): Promise<FirebaseFirestore.WriteResult | null> => {
  const oldRegistration = change.after.data as IRegistration;
  const newRegistration = change.after.data as IRegistration;

  if (!newRegistration.dateTimeSlot?.id) {
    return null;
  }

  const slotId: string = registration.dateTimeSlot.id;
  const increment = admin.firestore.FieldValue.increment(1);
  const shardIndex = Math.floor(Math.random() * 10);

  const doc = admin
    .firestore()
    .doc(`dateTimeSlots/${slotId}/shards/${shardIndex}`);

  return doc.set({ count: increment }, { merge: true });
};
