import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { onCall } from 'firebase-functions/v2/https';
import express from 'express';
import updateEmailAddress from '../../src/fn/updateEmailAddress';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	getAuth,
	getDocument,
	seedAuthUser,
	setDocument,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';

describe.sequential('updateEmailAddress integration', () => {
	let server: Server;
	let callableUrl: string;
	beforeAll(async () => {
		// Use the real callable protocol and token verification with local Auth.
		const app = express();
		app.use(express.json());
		app.post('/', onCall(updateEmailAddress));
		server = createServer(app);
		await new Promise<void>((resolve) =>
			server.listen(0, '127.0.0.1', resolve),
		);
		callableUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	});
	afterAll(async () => {
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve())),
		);
	});

	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('enforces token authentication age on direct callable requests and accepts a fresh password sign-in', async () => {
		const uid = 'token-boundary';
		const email = 'token-before@example.test';
		await seedAuthUser({ uid, email });
		const signIn = async (address: string): Promise<string> => {
			const response = await fetch(
				`http://${process.env['FIREBASE_AUTH_EMULATOR_HOST']}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
				{
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						email: address,
						password: 'UnitTest123!',
						returnSecureToken: true,
					}),
				},
			);
			expect(response.ok).toBe(true);
			return ((await response.json()) as { idToken: string }).idToken;
		};
		const invoke = (token: string): Promise<Response> =>
			fetch(callableUrl, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					data: {
						emailAddress: 'token-after@example.test',
						auth_time: Date.now() / 1000,
						password: 'ignored',
					},
				}),
			});
		const oldToken = await signIn(email);
		vi.useFakeTimers({ toFake: ['Date'] });
		try {
			vi.setSystemTime(Date.now() + 301_000);
			const rejected = await invoke(oldToken);
			expect(rejected.status).toBe(400);
			expect(await rejected.json()).toMatchObject({
				error: { status: 'FAILED_PRECONDITION' },
			});
			expect((await getAuth().getUser(uid)).email).toBe(email);
			expect(
				await getDocument(COLLECTION_SCHEMA.users, uid),
			).toBeUndefined();
		} finally {
			vi.useRealTimers();
		}
		const accepted = await invoke(await signIn(email));
		expect(accepted.ok).toBe(true);
		expect(await accepted.json()).toEqual({ result: true });
		await signIn('token-after@example.test');
	});

	it('updates the email address across auth and firestore documents', async () => {
		await seedAuthUser({
			uid: 'user-email-1',
			email: 'old.email@example.com',
			displayName: 'Buddy Elf',
		});
		await setDocument(COLLECTION_SCHEMA.users, 'user-email-1', {
			emailAddress: 'old.email@example.com',
		});
		await setDocument(
			COLLECTION_SCHEMA.registrationSearchIndex,
			'user-email-1',
			{
				emailAddress: 'old.email@example.com',
			},
		);
		await setDocument(COLLECTION_SCHEMA.registrations, 'user-email-1', {
			emailAddress: 'old.email@example.com',
		});

		const result = await updateEmailAddress(
			createCallableRequest(
				{ emailAddress: 'new.email@example.com' },
				{
					uid: 'user-email-1',
					email: 'old.email@example.com',
				},
			),
		);

		expect(result).toBe(true);
		const authUser = await getAuth().getUser('user-email-1');
		expect(authUser.email).toBe('new.email@example.com');
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrationSearchIndex,
				'user-email-1',
			),
		).toMatchObject({ emailAddress: 'new.email@example.com' });
	});
});
