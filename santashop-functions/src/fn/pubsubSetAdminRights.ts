import * as admin from 'firebase-admin';

admin.initializeApp();

export default async (): Promise<void> => {
	// TODO: Put these in an anvironment variable
	const adminUids: string[] = [
		'KF2cN3wX3bawCJaghN9JjLvdbB32', // dev
		'R8YIhtdS7qeV65aYF3jec2plLto1', // admin@denversantaclausshop.org
		'bIMHv99EssTqMfhX2kkYm2vErwu1', // santa1@northpole.com
		'xkeLDNPTVVPkt6Onh4EGYNuGi2C2', // santa2@northpole.com
		'sGVW9Om1E5UGKWcq97EpygbwQfl2', // santa3@northpole.com
		'2kNkKB4Xz5agjs6TfXzQStJ38gx1', // santa4@northpole.com
		'RDkrgjJE0oQAXY6peLoABJvOH2j2', // santa5@northpole.com
	];

	adminUids.forEach(async (uid) => {
		await admin.auth().setCustomUserClaims(uid, { admin: true });
	});

	return Promise.resolve();
};
