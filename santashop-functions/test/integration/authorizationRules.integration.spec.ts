import { beforeEach, describe, expect, it } from 'vitest';
import {
	clearEmulatorData,
	seedAuthUser,
	seedQrCode,
	setDocument,
} from '../helpers/admin-emulator';

const authEmulatorHost =
	process.env['FIREBASE_AUTH_EMULATOR_HOST'] ?? '127.0.0.1:9099';
const firestoreEmulatorHost =
	process.env['FIRESTORE_EMULATOR_HOST'] ?? '127.0.0.1:8080';
const storageEmulatorHost =
	process.env['FIREBASE_STORAGE_EMULATOR_HOST'] ?? '127.0.0.1:9199';

describe.sequential('staff claims and QR Storage rules', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it.each([
		{
			claims: { roles: ['admin'] },
			registrationAllowed: true,
			qrAllowed: true,
		},
		{ claims: { owner: true }, registrationAllowed: true, qrAllowed: true },
		{
			claims: { roles: ['checkin'] },
			registrationAllowed: true,
			qrAllowed: false,
		},
		{
			claims: { admin: true },
			registrationAllowed: false,
			qrAllowed: false,
		},
		{ claims: {}, registrationAllowed: false, qrAllowed: false },
	])(
		'enforces supported staff claims: $claims',
		async ({ claims, registrationAllowed, qrAllowed }) => {
			await seedAuthUser({
				uid: 'staff-rules',
				email: 'staff-rules@example.test',
				claims,
			});
			await setDocument('registrations', 'customer-rules', {
				uid: 'customer-rules',
			});
			await seedQrCode('registrations/customer-rules/canonical.png');
			await seedQrCode('registrations/customer-rules.png');
			const response = await fetch(
				`http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
				{
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						email: 'staff-rules@example.test',
						password: 'UnitTest123!',
						returnSecureToken: true,
					}),
				},
			);
			expect(response.ok).toBe(true);
			const { idToken } = (await response.json()) as { idToken: string };
			const headers = { authorization: `Bearer ${idToken}` };
			const registration = await fetch(
				`http://${firestoreEmulatorHost}/v1/projects/santas-workshop-test/databases/(default)/documents/registrations/customer-rules`,
				{ headers },
			);
			expect(registration.status).toBe(registrationAllowed ? 200 : 403);
			const bucket = `http://${storageEmulatorHost}/v0/b/santas-workshop-test.appspot.com/o/`;
			const canonical = await fetch(
				`${bucket}${encodeURIComponent('registrations/customer-rules/canonical.png')}?alt=media`,
				{ headers },
			);
			expect(canonical.status).toBe(qrAllowed ? 200 : 403);
			const unsupported = await fetch(
				`${bucket}${encodeURIComponent('registrations/customer-rules.png')}?alt=media`,
				{ headers },
			);
			expect(unsupported.status).toBe(403);
		},
	);
});
