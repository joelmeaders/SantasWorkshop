import * as admin from 'firebase-admin';

admin.initializeApp();

export default async (): Promise<void> => {
	// TODO: Put these in an anvironment variable
	const adminUids: string[] = [
		'KF2cN3wX3bawCJaghN9JjLvdbB32', // dev
		'dabX8OSbk0g8yIdNEIjSd89P8Mb2', // admin
	];

	adminUids.forEach(async (uid) => {
		await admin.auth().setCustomUserClaims(uid, { admin: true });
	});

	return Promise.resolve();
};
