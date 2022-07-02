import * as admin from 'firebase-admin';

admin.initializeApp();

export default async (): Promise<void> => {
	// TODO: Put these in an anvironment variable
	const adminUids: string[] = [
		'Qyvgav7d9Ye0RyJYCG2ZgQPppKt1',
		'dabX8OSbk0g8yIdNEIjSd89P8Mb2',
		'YjnlglWP1izlacDWi3D2Trx1FAnd', // dev environment
		'abSHiDLbWqdWawhfjfKSrN5naFA2',
	];

	adminUids.forEach(async (uid) => {
		try {
			await admin.auth().setCustomUserClaims(uid, { admin: true });
		} catch {
			// Do nothing.
			// Failures will happen between environments
		}
	});

	return Promise.resolve();
};
