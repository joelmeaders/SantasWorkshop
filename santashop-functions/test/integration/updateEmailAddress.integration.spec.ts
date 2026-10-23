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
	getFirestore,
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

	it('reports the actual login email after a failed record write and repairs the same intent on retry', async () => {
		const uid = 'email-recovery';
		await seedAuthUser({ uid, email: 'before@example.test' });
		for (const collection of [
			COLLECTION_SCHEMA.users,
			COLLECTION_SCHEMA.registrations,
			COLLECTION_SCHEMA.registrationSearchIndex,
		]) {
			await setDocument(collection, uid, {
				emailAddress: 'before@example.test',
				family: 'keep',
				booking: 'keep',
			});
		}
		const request = createCallableRequest(
			{
				mutationId: 'email-recovery-1',
				expectedEmailAddress: 'before@example.test',
				emailAddress: 'after@example.test',
			},
			{ uid },
		);
		const db = getFirestore();
		const makeBatch = db.batch.bind(db);
		const batchSpy = vi.spyOn(db, 'batch').mockImplementation(() => {
			const batch = makeBatch();
			vi.spyOn(batch, 'commit').mockRejectedValueOnce(
				new Error('Injected before commit'),
			);
			return batch;
		});
		await expect(
			updateEmailAddress(request as never),
		).rejects.toMatchObject({
			code: 'unavailable',
			details: {
				reason: 'email-change-incomplete',
				emailAddress: 'after@example.test',
				mutationId: 'email-recovery-1',
			},
		});
		expect((await getAuth().getUser(uid)).email).toBe('after@example.test');
		expect(
			await getDocument(COLLECTION_SCHEMA.registrations, uid),
		).toMatchObject({
			emailAddress: 'before@example.test',
			family: 'keep',
			booking: 'keep',
		});
		batchSpy.mockRestore();
		expect(await updateEmailAddress(request as never)).toBe(true);
		for (const collection of [
			COLLECTION_SCHEMA.users,
			COLLECTION_SCHEMA.registrations,
			COLLECTION_SCHEMA.registrationSearchIndex,
		]) {
			expect(await getDocument(collection, uid)).toMatchObject({
				emailAddress: 'after@example.test',
				family: 'keep',
				booking: 'keep',
			});
		}
	});

	it('recognizes a committed batch after its acknowledgement is lost and does not replay over a newer change', async () => {
		const uid = 'email-lost-ack';
		await seedAuthUser({ uid, email: 'first@example.test' });
		await setDocument(COLLECTION_SCHEMA.users, uid, {
			emailAddress: 'first@example.test',
		});
		const request = createCallableRequest(
			{
				mutationId: 'email-lost-ack-1',
				expectedEmailAddress: 'first@example.test',
				emailAddress: 'second@example.test',
			},
			{ uid },
		);
		const db = getFirestore();
		const makeBatch = db.batch.bind(db);
		vi.spyOn(db, 'batch').mockImplementation(() => {
			const batch = makeBatch();
			const commit = batch.commit.bind(batch);
			vi.spyOn(batch, 'commit').mockImplementationOnce(async () => {
				await commit();
				throw new Error('Injected lost acknowledgement');
			});
			return batch;
		});
		expect(await updateEmailAddress(request as never)).toBe(true);
		expect(await updateEmailAddress(request as never)).toBe(true);
		await updateEmailAddress(
			createCallableRequest(
				{
					mutationId: 'email-lost-ack-2',
					expectedEmailAddress: 'second@example.test',
					emailAddress: 'third@example.test',
				},
				{ uid },
			) as never,
		);
		await expect(
			updateEmailAddress(request as never),
		).rejects.toMatchObject({ code: 'aborted' });
		expect((await getAuth().getUser(uid)).email).toBe('third@example.test');
		expect(await getDocument(COLLECTION_SCHEMA.users, uid)).toMatchObject({
			emailAddress: 'third@example.test',
		});
		expect(
			await getDocument(COLLECTION_SCHEMA.registrations, uid),
		).toBeUndefined();
		expect(
			await getDocument(COLLECTION_SCHEMA.registrationSearchIndex, uid),
		).toBeUndefined();
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
						mutationId: 'token-boundary-change',
						expectedEmailAddress: email,
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

	it('serializes competing changes and lets an expired interrupted intent recover only with recent authentication', async () => {
		const uid = 'interrupted-email';
		await seedAuthUser({ uid, email: 'interrupted-after@example.test' });
		await setDocument(COLLECTION_SCHEMA.users, uid, {
			emailAddress: 'interrupted-before@example.test',
		});
		const intent = {
			mutationId: 'interrupted-change-1',
			emailAddress: 'interrupted-after@example.test',
			previousEmailAddress: 'interrupted-before@example.test',
			status: 'pending',
			attemptId: 'stopped-worker',
			leaseExpiresAt: Date.now() + 120_000,
		};
		const db = getFirestore();
		await db.doc('users/' + uid + '/emailChanges/state').set(intent);
		await db
			.doc('users/' + uid + '/emailChanges/' + intent.mutationId)
			.set(intent);
		const request = {
			mutationId: intent.mutationId,
			emailAddress: intent.emailAddress,
			expectedEmailAddress: intent.previousEmailAddress,
		};
		await expect(
			updateEmailAddress(createCallableRequest(request, { uid })),
		).rejects.toMatchObject({ code: 'aborted' });
		await expect(
			updateEmailAddress(
				createCallableRequest(
					{
						...request,
						mutationId: 'competing-change-1',
						emailAddress: 'competing@example.test',
					},
					{ uid },
				),
			),
		).rejects.toMatchObject({ code: 'aborted' });
		await db
			.doc('users/' + uid + '/emailChanges/state')
			.update({ leaseExpiresAt: Date.now() - 1 });
		await expect(
			updateEmailAddress(
				createCallableRequest(request, { uid, authTime: 1 }),
			),
		).rejects.toMatchObject({ code: 'failed-precondition' });
		expect(
			await updateEmailAddress(createCallableRequest(request, { uid })),
		).toBe(true);
		expect(await getDocument(COLLECTION_SCHEMA.users, uid)).toMatchObject({
			emailAddress: intent.emailAddress,
		});
		expect((await getAuth().getUser(uid)).email).toBe(intent.emailAddress);
	});

	it('keeps invalid and duplicate targets from changing the original identity or contact records', async () => {
		const uid = 'email-duplicate';
		await seedAuthUser({ uid, email: 'original@example.test' });
		await seedAuthUser({
			uid: 'other-account',
			email: 'taken@example.test',
		});
		await setDocument(COLLECTION_SCHEMA.users, uid, {
			emailAddress: 'original@example.test',
		});
		const request = {
			mutationId: 'duplicate-target-1',
			emailAddress: 'taken@example.test',
			expectedEmailAddress: 'original@example.test',
		};
		await expect(
			updateEmailAddress(createCallableRequest(request, { uid })),
		).rejects.toMatchObject({ code: 'already-exists' });
		await expect(
			updateEmailAddress(
				createCallableRequest(
					{ ...request, emailAddress: 'invalid' },
					{ uid },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
		expect((await getAuth().getUser(uid)).email).toBe(
			'original@example.test',
		);
		expect((await getAuth().getUser('other-account')).email).toBe(
			'taken@example.test',
		);
		expect(await getDocument(COLLECTION_SCHEMA.users, uid)).toEqual({
			emailAddress: 'original@example.test',
		});
		await updateEmailAddress(
			createCallableRequest(
				{
					...request,
					mutationId: 'different-target-1',
					emailAddress: 'available@example.test',
				},
				{ uid },
			),
		);
		expect((await getAuth().getUser(uid)).email).toBe(
			'available@example.test',
		);
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
				{
					emailAddress: 'new.email@example.com',
					mutationId: 'happy-email-change',
					expectedEmailAddress: 'old.email@example.com',
				},
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
