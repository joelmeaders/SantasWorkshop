import { beforeEach, describe, expect, it } from 'vitest';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	seedAuthUser,
	setDocument,
} from '../helpers/admin-emulator';

describe.sequential('customer registration Firestore rules', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('rejects authenticated direct registration and mutation receipt writes', async () => {
		const uid = 'rules-user-1';
		const emailAddress = 'rules-user-1@example.com';
		await Promise.all([
			seedAuthUser({ uid, email: emailAddress }),
			setDocument(COLLECTION_SCHEMA.registrations, uid, {
				uid,
				firstName: 'Rules',
				lastName: 'Tester',
			}),
		]);

		const authResponse = await fetch(
			'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key',
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					email: emailAddress,
					password: 'UnitTest123!',
					returnSecureToken: true,
				}),
			},
		);
		expect(authResponse.ok).toBe(true);
		const { idToken } = await authResponse.json() as { idToken: string };
		const firestoreBase =
			`http://127.0.0.1:8080/v1/projects/santas-workshop-test/databases/(default)/documents/${COLLECTION_SCHEMA.registrations}/${uid}`;
		const write = (url: string): Promise<Response> => fetch(url, {
			method: 'PATCH',
			headers: {
				'authorization': `Bearer ${idToken}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				fields: { firstName: { stringValue: 'Bypassed' } },
			}),
		});

		const [registrationWrite, receiptWrite] = await Promise.all([
			write(firestoreBase),
			write(`${firestoreBase}/mutationReceipts/client-receipt-1`),
		]);

		expect(registrationWrite.status).toBe(403);
		expect(receiptWrite.status).toBe(403);
	});
});
