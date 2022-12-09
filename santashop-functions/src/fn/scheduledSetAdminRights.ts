import * as admin from 'firebase-admin';

admin.initializeApp();

export default async (): Promise<void> => {
	// TODO: Put these in an anvironment variable
	const adminUids: string[] = [
		'KF2cN3wX3bawCJaghN9JjLvdbB32', // dev
		'R8YIhtdS7qeV65aYF3jec2plLto1', // admin@denversantaclausshop.org
		'wBgrMMPo59abiHfMqArNr6YxP8o2', // santa@northpole.com
		'hHXDyGDTROXMhSNUSF9paJuKhXl2', // admin@santa.com
		'p9jlQ7aRngO3BWWa1q088nYtdva2', // admin2@santa.com
	];

	adminUids.forEach(async (uid) => {
		await admin.auth().setCustomUserClaims(uid, { admin: true });
	});

	return Promise.resolve();
};
