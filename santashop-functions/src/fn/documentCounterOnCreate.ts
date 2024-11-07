import { EventContext } from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

admin.initializeApp();

export default async (context: EventContext) => {
	const IGNORE_COLLECTIONS = [
		'counters',
		'qrcodes',
		'children',
		'customers',
		'dateTimeSlots',
		'registrationemails',
		'tmp_registrationemails',
		'registrationsearchindex',
		'stats',
		'parameters',
	];
	const collection: string = context.params.collection;

	if (IGNORE_COLLECTIONS.includes(collection)) {
		return null;
	}

	const increment = admin.firestore.FieldValue.increment(1);
	const shardIndex = Math.floor(Math.random() * 10);

	const doc = admin
		.firestore()
		.doc(`counters/${collection}/shards/${shardIndex}`);

	return doc.set({ count: increment }, { merge: true });
};
