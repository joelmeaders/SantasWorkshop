import { randomBytes } from 'node:crypto';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type DocumentReference } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import performRegistrationReviewAction, {
	registrationReviewRevision,
} from '../../src/fn/performRegistrationReviewAction';
import sendRegistrationReviewEmail from '../../src/fn/sendRegistrationReviewEmail';
import { PROGRAM_YEAR } from '../../src/utility/runtime-config';
import { AgeGroup, COLLECTION_SCHEMA, ToyType } from '../../src/models';
import { createCallableRequest } from '../helpers/callable-context';

const projectId = 'demo-registration-review-actions';
const owner = { uid: 'fixture-owner', owner: true };
const reviewer = {
	uid: 'fixture-reviewer',
	roles: ['admin', 'registration-review'],
};
const ordinary = { uid: 'fixture-ordinary', roles: ['admin'] };
const at = new Date(PROGRAM_YEAR + '-11-16T20:45:00Z');
const original = new Date(PROGRAM_YEAR + '-11-15T12:00:00Z');
const appointment = new Date(PROGRAM_YEAR + '-12-10T20:00:00Z');

describe.skipIf(
	process.env['REGISTRATION_REVIEW_ACTIONS_EMULATOR_TEST'] !== 'true',
)('manual registration review actions, isolated Firestore', () => {
	let app: ReturnType<typeof initializeApp>;
	let db: ReturnType<typeof getFirestore>;
	beforeAll(() => {
		if (process.env['FIRESTORE_EMULATOR_HOST'] !== '127.0.0.1:18482')
			throw new Error(
				'This suite requires the dedicated actions emulator.',
			);
		vi.stubEnv('SANTASHOP_REGISTRATION_REVIEW_ENABLED', 'true');
		app = initializeApp({ projectId }, projectId);
		db = getFirestore(app);
	});
	afterAll(async () => {
		if (app) await deleteApp(app);
		vi.unstubAllEnvs();
	});

	async function fixture(): Promise<{
		caseRef: DocumentReference;
		person: DocumentReference;
		other: DocumentReference;
		slot: DocumentReference;
		email: string;
		request: Record<string, unknown>;
	}> {
		const caseId = randomBytes(32).toString('hex');
		const prefix = 'test-review-' + caseId.slice(0, 12);
		const person = db
			.collection(COLLECTION_SCHEMA.registrations)
			.doc(prefix + '-shopper');
		const other = db
			.collection(COLLECTION_SCHEMA.registrations)
			.doc(prefix + '-other');
		const slot = db.collection('dateTimeSlots').doc(prefix + '-slot');
		const caseRef = db.doc(
			'registrationReviewSeasons/' + PROGRAM_YEAR + '/cases/' + caseId,
		);
		const email = person.id + '@review.test';
		const children = ['Sample Child A', 'Sample Child B'].map(
			(firstName, index) => ({
				id: index,
				firstName,
				lastName: 'Test Child',
				dateOfBirth: new Date(PROGRAM_YEAR - 7 + '-06-01T00:00:00Z'),
				toyType: ToyType.boy,
				ageGroup: AgeGroup.age68,
				enabled: true,
			}),
		);
		await Promise.all([
			person.create({
				uid: person.id,
				firstName: 'Jamie',
				lastName: 'Sample',
				programYear: PROGRAM_YEAR,
				emailAddress: email,
				preferredLanguage: 'es',
				registrationSubmittedOn: original,
				dateTimeSlot: { id: slot.id, dateTime: appointment },
				children,
				qrcode: 'ABCD2468',
				qrCodeStoragePath: 'registrations/' + person.id + '/old.png',
			}),
			other.create({
				uid: other.id,
				programYear: PROGRAM_YEAR,
				emailAddress: other.id + '@review.test',
				registrationSubmittedOn: original,
				dateTimeSlot: { id: slot.id, dateTime: appointment },
			}),
			slot.create({
				programYear: PROGRAM_YEAR,
				dateTime: appointment,
				enabled: true,
				maxSlots: 1,
				slotsReserved: 1,
			}),
			caseRef.create({
				id: caseId,
				season: PROGRAM_YEAR,
				registrations: [person.id, other.id],
				history: [{ type: 'flagged', at: original.toISOString() }],
			}),
			db
				.collection(COLLECTION_SCHEMA.users)
				.doc(person.id)
				.create({ emailAddress: email }),
			db
				.collection(COLLECTION_SCHEMA.registrationSearchIndex)
				.doc(person.id)
				.create({ code: 'ABCD2468' }),
		]);
		return {
			person,
			other,
			caseRef,
			slot,
			email,
			request: {
				caseId,
				registrationId: person.id,
				expectedRevision: registrationReviewRevision(
					await person.get(),
				),
				reason: 'duplicate-registration',
			},
		};
	}

	async function bookingCount(slotId: string): Promise<number> {
		return (
			await db
				.collection(COLLECTION_SCHEMA.registrations)
				.where('registrationSubmittedOn', '!=', '')
				.where('dateTimeSlot.id', '==', slotId)
				.count()
				.get()
		).data().count;
	}

	it('cancels once, releases capacity without email by default, and reinstates into the full original slot with a fresh QR', async () => {
		const { person, other, caseRef, slot, request } = await fixture();
		const cancel = {
			...request,
			action: 'cancel',
			mutationId: 'cancel-booking',
		};
		await expect(
			performRegistrationReviewAction(
				createCallableRequest(cancel, ordinary),
				app,
				at,
			),
		).rejects.toMatchObject({ code: 'permission-denied' });
		await expect(
			performRegistrationReviewAction(
				createCallableRequest(cancel, reviewer),
				app,
				at,
			),
		).resolves.toEqual({
			action: 'cancel',
			registrationId: person.id,
			notification: 'not-requested',
		});
		let registration = await person.get();
		const canceledId = registration.get('cancellationLogId') as string;
		expect(registration.get('registrationSubmittedOn')).toBeUndefined();
		expect(registration.get('children')).toHaveLength(2);
		const cancelAudit = caseRef.collection('actions').doc('cancel-booking');
		expect(
			(await cancelAudit.collection('email').doc('delivery').get())
				.exists,
		).toBe(false);
		expect(await bookingCount(slot.id)).toBe(1);
		await expect(
			performRegistrationReviewAction(
				createCallableRequest(
					{ ...cancel, reason: 'Changed payload' },
					reviewer,
				),
				app,
				at,
			),
		).rejects.toMatchObject({ code: 'already-exists' });
		await expect(
			performRegistrationReviewAction(
				createCallableRequest(cancel, reviewer),
				app,
				at,
			),
		).resolves.toMatchObject({ action: 'cancel' });
		const reinstate = {
			...request,
			expectedRevision: registrationReviewRevision(registration),
			action: 'reinstate',
			reason: 'reviewed-and-cleared',
			mutationId: 'reinstate-booking',
		};
		const prepareQr = vi
			.fn<(uid: string, path: string, code: string) => Promise<void>>()
			.mockResolvedValue(undefined);
		await expect(
			performRegistrationReviewAction(
				createCallableRequest(reinstate, owner),
				app,
				at,
				prepareQr,
			),
		).resolves.toMatchObject({ action: 'reinstate' });
		registration = await person.get();
		expect(registration.get('dateTimeSlot.id')).toBe(slot.id);
		expect(registration.get('qrcode')).not.toBe('ABCD2468');
		expect(registration.get('registrationSubmittedOn').toDate()).toEqual(
			original,
		);
		expect(await bookingCount(slot.id)).toBe(2);
		expect((await other.get()).get('dateTimeSlot.id')).toBe(slot.id);
		expect(
			(
				await db
					.collection(COLLECTION_SCHEMA.cancellations)
					.doc(canceledId)
					.get()
			).get('supersededConfirmationCode'),
		).toBe('ABCD2468');
		await expect(
			performRegistrationReviewAction(
				createCallableRequest(reinstate, owner),
				app,
				at,
				prepareQr,
			),
		).resolves.toMatchObject({ action: 'reinstate' });
		expect(prepareQr).toHaveBeenCalledTimes(1);
		expect((await caseRef.collection('actions').get()).size).toBe(2);
	});

	it('rejects plaintext, cross-action reasons, and child email without recording any action', async () => {
		const { caseRef, email, person, request } = await fixture();
		const base = {
			...request,
			action: 'removeChild',
			reason: 'duplicate-child-entry',
			mutationId: 'remove-child',
			childIndex: 0,
		};
		for (const payload of [
			{ ...base, reason: 'Private freetext' },
			{ ...base, reason: 'reviewed-and-cleared' },
			{
				...base,
				action: 'editChild',
				reason: 'correct-child-information',
				child: {
					firstName: 'Synthetic',
					lastName: 'Child',
					birthDate: '2018-11-18',
				},
				notification: { recipient: email },
			},
			{
				...base,
				action: 'restoreChild',
				reason: 'child-removed-in-error',
				notification: { recipient: email },
			},
			{
				...base,
				reason: 'duplicate-child-entry',
				notification: {
					recipient: email,
					customMessage: 'Do not queue',
				},
			},
		]) {
			await expect(
				performRegistrationReviewAction(
					createCallableRequest(payload, reviewer),
					app,
					at,
				),
			).rejects.toMatchObject({ code: 'invalid-argument' });
		}
		expect((await caseRef.collection('actions').get()).empty).toBe(true);
		expect((await person.get()).get('children')).toHaveLength(2);
		await expect(
			performRegistrationReviewAction(
				createCallableRequest(
					{ ...base, reason: 'duplicate-child-entry' },
					reviewer,
				),
				app,
				at,
			),
		).resolves.toMatchObject({ notification: 'not-requested' });
		const action = caseRef.collection('actions').doc('remove-child');
		expect((await action.get()).get('reason')).toBe(
			'duplicate-child-entry',
		);
		expect((await action.collection('email').get()).empty).toBe(true);
	});

	it('records reviewer contact as opt-in to the affected recipient only and protects private history', async () => {
		const { caseRef, email, person, other, request } = await fixture();
		await caseRef
			.collection('notes')
			.doc('private-note')
			.create({ text: 'Never include this.' });
		const base = {
			...request,
			action: 'contact',
			reason: 'verify-registration',
			mutationId: 'contact-shopper',
		};
		await expect(
			performRegistrationReviewAction(
				createCallableRequest(
					{
						...base,
						notification: { recipient: other.id + '@review.test' },
					},
					reviewer,
				),
				app,
				at,
			),
		).rejects.toMatchObject({ code: 'aborted' });
		await expect(
			performRegistrationReviewAction(
				createCallableRequest(
					{
						...base,
						notification: {
							recipient: email,
							customMessage: '<Please reply> esto.',
						},
					},
					reviewer,
				),
				app,
				at,
			),
		).resolves.toMatchObject({ notification: 'queued' });
		const job = (
			await caseRef
				.collection('actions')
				.doc('contact-shopper')
				.collection('email')
				.doc('delivery')
				.get()
		).data();
		expect(job).toMatchObject({
			recipient: email,
			replyTo: 'president@denversantaclausshop.org',
			registrationId: person.id,
			subject: 'Confirme su inscripción para Santa Shop',
			state: 'queued',
		});
		expect(job?.['html']).toContain('&lt;Please reply&gt;');
		expect(JSON.stringify(job)).not.toMatch(
			/Never include|verify-registration|Sample Child|other@review\.test/u,
		);
		await expect(
			performRegistrationReviewAction(
				createCallableRequest(
					{
						...request,
						action: 'blacklist',
						mutationId: 'block-shopper',
					},
					owner,
				),
				app,
				at,
			),
		).rejects.toMatchObject({ code: 'failed-precondition' });
	});

	it('delivers an authorized message only once and supersedes a changed recipient', async () => {
		const { caseRef, person, request, email } = await fixture();
		const submitContact = async (mutationId: string): Promise<void> => {
			await performRegistrationReviewAction(
				createCallableRequest(
					{
						...request,
						action: 'contact',
						reason: 'verify-registration',
						mutationId,
						notification: {
							recipient: email,
							customMessage: 'Please reply.',
						},
					},
					reviewer,
				),
				app,
				at,
			);
		};
		const send = vi
			.fn<
				NonNullable<
					Parameters<typeof sendRegistrationReviewEmail>[2]
				>['send']
			>()
			.mockResolvedValue('provider-receipt-1');
		const deps = {
			enabled: async (): Promise<boolean> => true,
			isSink: (): boolean => false,
			sink: vi.fn(),
			send,
		};
		await submitContact('first-contact');
		const firstQueue = caseRef
			.collection('actions')
			.doc('first-contact')
			.collection('email');
		const event = (await firstQueue.get()).docs[0];
		await sendRegistrationReviewEmail(event, at.toISOString(), deps, at);
		await sendRegistrationReviewEmail(event, at.toISOString(), deps, at);
		expect(send).toHaveBeenCalledTimes(1);
		expect(send.mock.calls[0]?.[0].input).toMatchObject({
			Destination: { ToAddresses: [email] },
			ReplyToAddresses: ['president@denversantaclausshop.org'],
		});
		expect((await event.ref.get()).get('state')).toBe('sent');
		await submitContact('second-contact');
		const secondQueue = caseRef
			.collection('actions')
			.doc('second-contact')
			.collection('email');
		const stale = (await secondQueue.get()).docs[0];
		await person.update({ emailAddress: 'changed@review.test' });
		await sendRegistrationReviewEmail(stale, at.toISOString(), deps, at);
		expect(send).toHaveBeenCalledTimes(1);
		expect((await stale.ref.get()).get('state')).toBe('superseded');
	});

	it('requires a valid original slot and reuses the same prepared QR after a failed upload', async () => {
		const { person, slot, request, caseRef } = await fixture();
		await performRegistrationReviewAction(
			createCallableRequest(
				{ ...request, action: 'cancel', mutationId: 'cancel-attempt' },
				owner,
			),
			app,
			at,
		);
		const current = await person.get();
		const reinstate = {
			...request,
			expectedRevision: registrationReviewRevision(current),
			action: 'reinstate',
			reason: 'reviewed-and-cleared',
			mutationId: 'reinstate-retry',
		};
		const prepare = vi
			.fn<(uid: string, path: string, code: string) => Promise<void>>()
			.mockRejectedValueOnce(new Error('Test QR outage'))
			.mockResolvedValue(undefined);
		await slot.update({ programYear: PROGRAM_YEAR - 1 });
		await expect(
			performRegistrationReviewAction(
				createCallableRequest(reinstate, owner),
				app,
				at,
				prepare,
			),
		).rejects.toMatchObject({ code: 'failed-precondition' });
		expect(prepare).not.toHaveBeenCalled();
		await slot.update({ programYear: PROGRAM_YEAR });
		await expect(
			performRegistrationReviewAction(
				createCallableRequest(reinstate, owner),
				app,
				at,
				prepare,
			),
		).rejects.toThrow('Test QR outage');
		expect(
			(await caseRef.collection('actions').doc('reinstate-retry').get())
				.exists,
		).toBe(false);
		expect(
			(await person.get()).get('registrationSubmittedOn'),
		).toBeUndefined();
		await expect(
			performRegistrationReviewAction(
				createCallableRequest(reinstate, owner),
				app,
				at,
				prepare,
			),
		).resolves.toMatchObject({ action: 'reinstate' });
		expect(prepare).toHaveBeenCalledTimes(2);
		expect(prepare.mock.calls[1]).toEqual(prepare.mock.calls[0]);
	});

	it('pauses and restores only shopper access, and keeps the previous child values before editing', async () => {
		const { person, slot, request, caseRef } = await fixture();
		const disable = {
			...request,
			action: 'disable',
			reason: 'both-parents-registered-same-children',
			mutationId: 'pause-access',
		};
		await performRegistrationReviewAction(
			createCallableRequest(disable, reviewer),
			app,
			at,
		);
		const accessRef = db
			.collection(COLLECTION_SCHEMA.shopperAccess)
			.doc(person.id);
		expect((await accessRef.get()).get('disabled')).toBe(true);
		let current = await person.get();
		expect(current.get('dateTimeSlot.id')).toBe(slot.id);
		expect(
			(
				await db
					.collection(COLLECTION_SCHEMA.shopperAccess)
					.doc(person.id)
					.collection('audit')
					.doc('current')
					.get()
			).get('reason'),
		).toBe('both-parents-registered-same-children');
		await performRegistrationReviewAction(
			createCallableRequest(
				{
					...request,
					expectedRevision: registrationReviewRevision(current),
					action: 'enable',
					reason: 'reviewed-and-cleared',
					mutationId: 'restore-access',
				},
				reviewer,
			),
			app,
			at,
		);
		expect((await accessRef.get()).get('disabled')).toBe(false);
		expect((await accessRef.collection('audit').get()).size).toBe(3);
		current = await person.get();
		await performRegistrationReviewAction(
			createCallableRequest(
				{
					...request,
					expectedRevision: registrationReviewRevision(current),
					action: 'editChild',
					reason: 'correct-child-information',
					mutationId: 'edit-child',
					childIndex: 0,
					child: {
						firstName: 'Avery',
						lastName: 'Sample',
						birthDate: PROGRAM_YEAR - 7 + '-06-01',
					},
				},
				reviewer,
			),
			app,
			at,
		);
		expect((await person.get()).get('children')[0]).toMatchObject({
			firstName: 'Avery',
			toyType: ToyType.boy,
		});
		expect(
			(await caseRef.collection('actions').doc('edit-child').get()).get(
				'previousChild.firstName',
			),
		).toBe('Sample Child A');
	});

	it('requires an Owner/current cancellation and leaves the policy active during an explicit Auth retry', async () => {
		const { person, caseRef, email, request } = await fixture();
		vi.stubEnv('SANTASHOP_REGISTRATION_REVIEW_DENYLIST_ENABLED', 'true');
		vi.stubEnv(
			'SANTASHOP_REGISTRATION_REVIEW_DENYLIST_HMAC_KEY',
			Buffer.alloc(32, 29).toString('base64'),
		);
		const principal = {
			uid: person.id,
			email,
			disabled: false,
			emailVerified: true,
		};
		const auth = {
			getUser: vi.fn(async () => ({ ...principal })),
			updateUser: vi.fn(
				async (_uid: string, state: { disabled: true }) => {
					principal.disabled = state.disabled;
				},
			),
			revokeRefreshTokens: vi
				.fn<(uid: string) => Promise<void>>()
				.mockRejectedValueOnce(new Error('Mock provider failure'))
				.mockResolvedValue(undefined),
		};
		const invoke = (
			input: Record<string, unknown>,
			actor = owner,
		): ReturnType<typeof performRegistrationReviewAction> =>
			performRegistrationReviewAction(
				createCallableRequest(input, actor),
				app,
				at,
				undefined,
				auth,
			);
		try {
			const block = {
				...request,
				action: 'blacklist',
				mutationId: 'owner-block-01',
				notification: { recipient: email },
			};
			await expect(
				performRegistrationReviewAction(
					createCallableRequest(block, reviewer),
					app,
					at,
					undefined,
					auth,
				),
			).rejects.toMatchObject({ code: 'permission-denied' });
			await expect(invoke(block)).rejects.toMatchObject({
				code: 'failed-precondition',
			});
			expect(auth.updateUser).not.toHaveBeenCalled();
			await invoke({
				...request,
				action: 'cancel',
				mutationId: 'owner-cancel-01',
			});
			const activeBlock = {
				...block,
				expectedRevision: registrationReviewRevision(
					await person.get(),
				),
			};
			await expect(invoke(activeBlock)).rejects.toMatchObject({
				code: 'unavailable',
				details: { reviewActionState: 'block-active-auth-unverified' },
			});
			const marker = db
				.collection('registrationReviewAuthOperations')
				.doc(person.id);
			expect((await marker.get()).get('state')).toBe('failed');
			expect(
				(
					await db
						.collection('registrationReviewUidBlocks')
						.doc(person.id)
						.get()
				).get('active'),
			).toBe(true);
			expect(
				(
					await caseRef
						.collection('actions')
						.doc('owner-block-01')
						.get()
				).exists,
			).toBe(false);
			expect(principal.disabled).toBe(true);
			await expect(invoke(activeBlock)).resolves.toMatchObject({
				authAccess: 'disabled-and-revoked',
				notification: 'queued',
			});
			expect((await marker.get()).get('state')).toBe('confirmed');
			expect(auth.updateUser).toHaveBeenCalledTimes(1);
			expect(auth.revokeRefreshTokens).toHaveBeenCalledTimes(2);
			await expect(invoke(activeBlock)).resolves.toMatchObject({
				authAccess: 'disabled-and-revoked',
			});
			expect(auth.revokeRefreshTokens).toHaveBeenCalledTimes(2);
			const clear = {
				...request,
				action: 'unblacklist',
				reason: 'reviewed-and-cleared',
				mutationId: 'owner-unblock-01',
				expectedRevision: registrationReviewRevision(
					await person.get(),
				),
			};
			await expect(invoke(clear)).resolves.toMatchObject({
				authAccess: 'requires-manual-review',
			});
			expect(principal.disabled).toBe(true);
			expect((await marker.get()).get('state')).toBe('cleared');
			expect(
				(
					await db
						.collection('registrationReviewUidBlocks')
						.doc(person.id)
						.get()
				).get('active'),
			).toBe(false);
			await expect(invoke(activeBlock)).rejects.toMatchObject({
				code: 'aborted',
			});
			expect(auth.revokeRefreshTokens).toHaveBeenCalledTimes(2);
		} finally {
			vi.stubEnv(
				'SANTASHOP_REGISTRATION_REVIEW_DENYLIST_ENABLED',
				'false',
			);
		}
	});

	it('does not remove policy while confirmed Auth disable is still in flight', async () => {
		const { person, request, email } = await fixture();
		vi.stubEnv('SANTASHOP_REGISTRATION_REVIEW_DENYLIST_ENABLED', 'true');
		vi.stubEnv(
			'SANTASHOP_REGISTRATION_REVIEW_DENYLIST_HMAC_KEY',
			Buffer.alloc(32, 29).toString('base64'),
		);
		const principal = {
			uid: person.id,
			email,
			disabled: false,
			emailVerified: true,
		};
		const auth = {
			getUser: async (): Promise<typeof principal> => ({ ...principal }),
			updateUser: async (
				_uid: string,
				state: { disabled: true },
			): Promise<void> => {
				principal.disabled = state.disabled;
			},
			revokeRefreshTokens: vi.fn<(uid: string) => Promise<void>>(),
		};
		let settle: (() => void) | undefined;
		auth.revokeRefreshTokens.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					settle = resolve;
				}),
		);
		const invoke = (
			input: Record<string, unknown>,
		): ReturnType<typeof performRegistrationReviewAction> =>
			performRegistrationReviewAction(
				createCallableRequest(input, owner),
				app,
				at,
				undefined,
				auth,
			);
		try {
			await invoke({
				...request,
				action: 'cancel',
				mutationId: 'overlap-cancel',
			});
			const base = {
				...request,
				expectedRevision: registrationReviewRevision(
					await person.get(),
				),
			};
			const blocking = invoke({
				...base,
				action: 'blacklist',
				mutationId: 'overlap-block',
			});
			await vi.waitFor(() =>
				expect(auth.revokeRefreshTokens).toHaveBeenCalledOnce(),
			);
			await expect(
				invoke({
					...base,
					action: 'unblacklist',
					reason: 'reviewed-and-cleared',
					mutationId: 'overlap-unblock',
				}),
			).rejects.toMatchObject({ code: 'failed-precondition' });
			expect(
				(
					await db
						.collection('registrationReviewUidBlocks')
						.doc(person.id)
						.get()
				).get('active'),
			).toBe(true);
			settle?.();
			await expect(blocking).resolves.toMatchObject({
				authAccess: 'disabled-and-revoked',
			});
		} finally {
			settle?.();
			vi.stubEnv(
				'SANTASHOP_REGISTRATION_REVIEW_DENYLIST_ENABLED',
				'false',
			);
		}
	});

	it('soft-removes from the active roster and can restore the same protected child record', async () => {
		const { person, caseRef, request } = await fixture();
		const remove = {
			...request,
			action: 'removeChild',
			reason: 'duplicate-child-entry',
			mutationId: 'remove-child',
			childIndex: 0,
		};
		await performRegistrationReviewAction(
			createCallableRequest(remove, reviewer),
			app,
			at,
		);
		const current = await person.get();
		expect(current.get('children')).toHaveLength(1);
		expect(
			(await person.collection('review').doc('roster').get()).get(
				'children',
			),
		).toMatchObject([{ id: 0 }]);
		expect(
			(await caseRef.collection('actions').doc('remove-child').get()).get(
				'previousChild.id',
			),
		).toBe(0);
		await expect(
			performRegistrationReviewAction(
				createCallableRequest(
					{ ...remove, mutationId: 'stale-second-remove' },
					reviewer,
				),
				app,
				at,
			),
		).rejects.toMatchObject({ code: 'aborted' });
		await performRegistrationReviewAction(
			createCallableRequest(
				{
					...remove,
					expectedRevision: registrationReviewRevision(current),
					action: 'restoreChild',
					reason: 'child-removed-in-error',
					mutationId: 'restore-child',
				},
				reviewer,
			),
			app,
			at,
		);
		expect((await person.get()).get('children')).toMatchObject([
			{ id: 1 },
			{ id: 0 },
		]);
	});
});
