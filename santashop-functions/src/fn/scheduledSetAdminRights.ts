import * as admin from 'firebase-admin';

admin.initializeApp();

export default async (): Promise<void> => {
	// TODO: Put these in an anvironment variable
	const adminUids: string[] = [
		'KF2cN3wX3bawCJaghN9JjLvdbB32', // dev
		'R8YIhtdS7qeV65aYF3jec2plLto1', // admin@denversantaclausshop.org
		'Z2KeTpGq0YanC8elBlUByPBtDJa2', // santa@northpole.com
		'FtyCYOpCPRMIPMgv3zLrWG7hQNT2', // admin@santa.com
		'cljKScnujIaMu4V74tF4CUxaFdl2', // admin2@santa.com
	];

	adminUids.forEach(async (uid) => {
		await admin.auth().setCustomUserClaims(uid, { admin: true });
	});

	return Promise.resolve();
};
