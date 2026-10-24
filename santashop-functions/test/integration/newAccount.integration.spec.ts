import { createHash } from 'node:crypto';
import { prepareAccountProvisioning } from '../../src/fn/accountProvisioning';
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';
import newAccount from '../../src/fn/newAccount';
import { COLLECTION_SCHEMA } from '@santashop/models';
import { createOnboardUser } from '../fixtures/factories';
import { createCallableRequest } from '../helpers/callable-context';
import {
	clearEmulatorData,
	getAuth,
	getAdminApp,
	getCollectionCount,
	seedAuthUser,
	getFirestore,
} from '../helpers/admin-emulator';

describe.sequential('newAccount integration', () => {
	beforeAll(() => {
		getFirestore();
	});

	beforeEach(async () => {
		await clearEmulatorData();
	});

	afterAll(async () => {
		await clearEmulatorData();
	});

	it('creates auth and firestore records when creating a new account', async () => {
		const onboardUser = createOnboardUser({
			emailAddress: 'integration.buddy.elf@example.com',
			referredBy: '  School Counselor  ',
		});

		const uid = await newAccount(createCallableRequest(onboardUser));

		const authUser = await getAuth().getUser(uid);
		const userDocument = await getFirestore()
			.collection(COLLECTION_SCHEMA.users)
			.doc(uid)
			.get();
		const registrationDocument = await getFirestore()
			.collection(COLLECTION_SCHEMA.registrations)
			.doc(uid)
			.get();

		expect(authUser.email).toBe('integration.buddy.elf@example.com');
		expect(userDocument.exists).toBe(true);
		expect(userDocument.data()).toMatchObject({
			firstName: 'Buddy',
			lastName: 'Elf',
			emailAddress: 'integration.buddy.elf@example.com',
			newsletter: true,
			referredBy: 'School Counselor',
		});
		expect(registrationDocument.exists).toBe(true);
		expect(registrationDocument.data()).toMatchObject({
			uid,
			firstName: 'Buddy',
			lastName: 'Elf',
			emailAddress: 'integration.buddy.elf@example.com',
			zipCode: '80205',
		});
		expect(registrationDocument.data()).not.toHaveProperty('referredBy');
	});

	it('surfaces an already-exists error when creating the same account twice', async () => {
		const onboardUser = createOnboardUser({
			emailAddress: 'duplicate.integration@example.com',
		});

		await newAccount(createCallableRequest(onboardUser));

		await expect(
			newAccount(createCallableRequest(onboardUser)),
		).rejects.toMatchObject({ code: 'already-exists' });
	});

	it.each([
		' winter-pass-2026',
		'winter-pass-2026 ',
		' winter-pass-2026 ',
		'winter pass 2026',
	])(
		'authenticates the original raw password in the Auth emulator',
		async (password) => {
			const onboardUser = createOnboardUser({
				emailAddress: 'raw-password@example.com',
				password,
				password2: password,
			});
			const uid = await newAccount(createCallableRequest(onboardUser));
			getAuth(); // Assert loopback emulator endpoints before sending credentials.
			const signIn = (value: string): Promise<Response> =>
				fetch(
					'http://' +
						process.env['FIREBASE_AUTH_EMULATOR_HOST'] +
						'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-test-key',
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							email: onboardUser.emailAddress,
							password: value,
							returnSecureToken: true,
						}),
					},
				);
			const response = await signIn(password);
			expect(response.status).toBe(200);
			expect(await response.json()).toMatchObject({ localId: uid });
			if (password !== password.trim())
				expect((await signIn(password.trim())).status).toBe(400);
		},
	);
	it.each(['auth', 'records', 'upload', 'metadata'] as const)(
		'resumes interruption after %s without deleting or duplicating account data',
		async (phase) => {
			const input = createOnboardUser({
				emailAddress: 'interrupted@example.test',
			});
			const uid =
				'signup_' +
				createHash('sha256').update(input.mutationId!).digest('hex');
			const auth = getAuth();
			const create = auth.createUser.bind(auth);
			const db = getFirestore();
			const transact = db.runTransaction.bind(db);
			let count = 0;
			const transactionSpy = vi
				.spyOn(db, 'runTransaction')
				.mockImplementation(
					async (...args: Parameters<typeof db.runTransaction>) => {
						count++;
						if (phase === 'upload' && count === 3)
							throw new Error(
								'Interrupted before final status write',
							);
						const result = await transact(...args);
						if (
							(phase === 'records' && count === 2) ||
							(phase === 'metadata' && count === 3)
						)
							throw new Error('Lost committed acknowledgement');
						return result;
					},
				);
			const authSpy = vi
				.spyOn(auth, 'createUser')
				.mockImplementation(async (data) => {
					const result = await create(data);
					if (phase === 'auth')
						throw new Error('Interrupted after Auth created');
					return result;
				});
			const started = newAccount(createCallableRequest(input));
			if (phase === 'metadata') expect(await started).toBe(uid);
			else await expect(started).rejects.toThrow();
			authSpy.mockRestore();
			transactionSpy.mockRestore();
			expect((await auth.getUser(uid)).email).toBe(input.emailAddress);
			const intentRef = db.doc('users/' + uid + '/provisioning/signup');
			const intent = (await intentRef.get()).data()!;
			expect(JSON.stringify(intent)).not.toContain(input.password);
			const path = intent['registration'].qrCodeStoragePath;
			const file = getAdminApp().storage().bucket().file(path);
			let generation: string | undefined;
			if (phase === 'upload' || phase === 'metadata')
				generation = (await file.getMetadata())[0].generation;
			if (phase === 'records') {
				await expect(
					newAccount(
						createCallableRequest({ resume: true }, { uid }),
					),
				).rejects.toMatchObject({ code: 'unavailable' });
				await intentRef.update({
					leaseUntil: new Date(Date.now() - 1),
				});
			}
			await newAccount(createCallableRequest({ resume: true }, { uid }));
			await newAccount(createCallableRequest({ resume: true }, { uid }));
			expect((await auth.listUsers()).users).toHaveLength(1);
			expect(await getCollectionCount(COLLECTION_SCHEMA.users)).toBe(1);
			expect(
				await getCollectionCount(COLLECTION_SCHEMA.registrations),
			).toBe(1);
			expect(
				(await db.doc('registrations/' + uid).get()).data(),
			).toMatchObject({
				qrcode: intent['registration'].qrcode,
				qrCodeStoragePath: path,
				qrCodeGeneratedOn: expect.anything(),
			});
			expect(
				(
					await getAdminApp()
						.storage()
						.bucket()
						.getFiles({ prefix: 'registrations/' + uid + '/' })
				)[0],
			).toHaveLength(1);
			if (generation)
				expect((await file.getMetadata())[0].generation).toBe(
					generation,
				);
		},
	);

	it('concurrent authenticated recovery preserves existing family, booking, and profile edits', async () => {
		const profile = {
			firstName: 'Buddy',
			lastName: 'Elf',
			emailAddress: 'concurrent@example.test',
			zipCode: '80205',
			newsletter: false,
		};
		const uid = await prepareAccountProvisioning(
			'concurrent-signup-1',
			profile,
		);
		await seedAuthUser({ uid, email: profile.emailAddress });
		const db = getFirestore();
		const saved = (
			await db.doc('users/' + uid + '/provisioning/signup').get()
		).data()!;
		await db.doc('users/' + uid).update({ firstName: 'Edited' });
		await db
			.doc('registrations/' + uid)
			.set({
				...saved['registration'],
				children: [{ firstName: 'Keep child' }],
				dateTimeSlot: { id: 'keep-slot' },
				registrationSubmittedOn: new Date(),
			});
		const request = createCallableRequest({ resume: true }, { uid });
		const outcomes = await Promise.allSettled([
			newAccount(request),
			newAccount(request),
		]);
		expect(outcomes.some((outcome) => outcome.status === 'fulfilled')).toBe(
			true,
		);
		await newAccount(request);
		expect((await db.doc('users/' + uid).get()).data()).toMatchObject({
			firstName: 'Edited',
		});
		expect(
			(await db.doc('registrations/' + uid).get()).data(),
		).toMatchObject({
			children: [{ firstName: 'Keep child' }],
			dateTimeSlot: { id: 'keep-slot' },
			registrationSubmittedOn: expect.anything(),
		});
		expect(
			(
				await getAdminApp()
					.storage()
					.bucket()
					.getFiles({ prefix: 'registrations/' + uid + '/' })
			)[0],
		).toHaveLength(1);
	});

	it('rejects unauthenticated duplicate-email recovery without changing the existing account', async () => {
		const input = createOnboardUser();
		const uid = await newAccount(createCallableRequest(input));
		const before = (
			await getFirestore()
				.doc('users/' + uid)
				.get()
		).data();
		await expect(
			newAccount({
				data: {
					...input,
					mutationId: 'different-attempt',
					firstName: 'Intruder',
					password: 'WrongPassword123!',
					password2: 'WrongPassword123!',
				},
			} as never),
		).rejects.toMatchObject({ code: 'already-exists' });
		expect(
			(
				await getFirestore()
					.doc('users/' + uid)
					.get()
			).data(),
		).toEqual(before);
		expect(await getCollectionCount(COLLECTION_SCHEMA.users)).toBe(1);
		await expect(
			newAccount({ data: { resume: true, uid } } as never),
		).rejects.toMatchObject({ code: 'unauthenticated' });
	});

	it('preserves an unrelated QR object and stops after the recovery attempt budget', async () => {
		const profile = {
			firstName: 'Buddy',
			lastName: 'Elf',
			emailAddress: 'qr-conflict@example.test',
			zipCode: '80205',
			newsletter: false,
		};
		const uid = await prepareAccountProvisioning(
			'qr-conflict-signup',
			profile,
		);
		await seedAuthUser({ uid, email: profile.emailAddress });
		const intentRef = getFirestore().doc(
			'users/' + uid + '/provisioning/signup',
		);
		const saved = (await intentRef.get()).data()!;
		const file = getAdminApp()
			.storage()
			.bucket()
			.file(saved['registration'].qrCodeStoragePath);
		await file.save('unrelated-object', { resumable: false });
		const request = createCallableRequest({ resume: true }, { uid });
		for (let attempt = 0; attempt < 3; attempt++)
			await expect(newAccount(request)).rejects.toMatchObject({
				code: 'unavailable',
			});
		await expect(newAccount(request)).rejects.toMatchObject({
			code: 'failed-precondition',
		});
		expect((await intentRef.get()).data()!['attemptCount']).toBe(3);
		expect((await file.download())[0].toString()).toBe('unrelated-object');
		expect((await getAuth().getUser(uid)).email).toBe(profile.emailAddress);
	});
});
