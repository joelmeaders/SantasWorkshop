import { createHash, randomUUID } from 'node:crypto';
import admin from '../firebase-admin';

export const EMAIL_SINK_COLLECTION = 'emailSinkReceipts';
export const EMAIL_ISOLATION_PROJECT = 'santas-workshop-test';

/** This application guard supplements, but never replaces, the VPC deny rule. */
export const isEmailSink = (): boolean => {
	const mode = process.env['SANTASHOP_EMAIL_TRANSPORT'] ?? 'ses';
	if (mode === 'ses') return false;
	if (mode !== 'sink')
		throw new Error('Unknown email transport. Delivery blocked.');
	const projects = [
		process.env['GCLOUD_PROJECT'],
		process.env['GCP_PROJECT'],
	];
	const firebaseConfig = process.env['FIREBASE_CONFIG'];
	if (firebaseConfig) projects.push(JSON.parse(firebaseConfig).projectId);
	const configured = projects.filter(Boolean);
	if (
		!configured.length ||
		configured.some((value) => value !== EMAIL_ISOLATION_PROJECT)
	) {
		throw new Error(
			'The email sink is restricted to santas-workshop-test.',
		);
	}
	if (
		Object.entries(process.env).some(
			([key, value]) => key.startsWith('AWS_') && !!value,
		)
	) {
		throw new Error(
			'AWS configuration is present in an isolated email workload.',
		);
	}
	return true;
};

/** Never stores recipients, message bodies, password reset links, or AWS acceptance fields. */
export const recordSimulatedEmail = async (
	kind: 'registration' | 'password-reset' | 'template-test',
	content: unknown,
	id = randomUUID(),
): Promise<string> => {
	if (!isEmailSink())
		throw new Error('The isolated email sink is not enabled.');
	if (!/^[A-Za-z0-9_-]{1,150}$/.test(id))
		throw new Error('Invalid sink receipt ID.');
	const serialized = JSON.stringify(content);
	const receiptId = `${kind}-${id}`;
	await admin
		.firestore()
		.doc(`${EMAIL_SINK_COLLECTION}/${receiptId}`)
		.set({
			provider: 'test-sink',
			simulated: true,
			kind,
			contentSha256: createHash('sha256')
				.update(serialized)
				.digest('hex'),
			contentBytes: Buffer.byteLength(serialized, 'utf8'),
			completedOn: new Date(),
		});
	return receiptId;
};
