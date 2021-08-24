import {EventContext} from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

export default async (
    context: EventContext
) => {
  const IGNORE_COLLECTIONS = ["counters", "qrcodes", "registrationemails",
    "registrationsearchindex", "stats", "parameters"];
  const collection = context.params.collection;

  if (IGNORE_COLLECTIONS.includes(collection)) {
    return null;
  }

  const decrement = admin.firestore.FieldValue.increment(-1);
  const shardIndex = Math.floor(Math.random() * 10);

  const doc = admin.firestore()
      .doc(`counters/${collection}/shards/${shardIndex}`);

  return doc.set({count: decrement}, {merge: true});
};
