import { beforeEach, describe, expect, it, vi } from 'vitest';
import completeRegistration from '../../src/fn/completeRegistration';
import setDraftAppointment from '../../src/fn/setDraftAppointment';
import changeRegistrationDateTime from '../../src/fn/changeRegistrationDateTime';
import scheduledDateTimeSlotCounters from '../../src/fn/reconcileAppointmentCounters';
import { COLLECTION_SCHEMA } from '@santashop/models';
import { createRegistration } from '../fixtures/factories';
import {
	clearEmulatorData,
	getDocument,
	getFirestore,
	setDocument,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';

describe.sequential('completeRegistration integration', () => {
	beforeEach(async () => {
		vi.spyOn(Date, 'now').mockReturnValue(
			Date.parse('2025-12-01T00:00:00.000Z'),
		);
		await clearEmulatorData();
	});

	const seedBooking = async (): Promise<void> => {
		await Promise.all([
			setDocument(
				COLLECTION_SCHEMA.registrations,
				'boundary-user',
				createRegistration({ uid: 'boundary-user' }),
			),
			setDocument(COLLECTION_SCHEMA.users, 'boundary-user', {
				firstName: 'Buddy',
				lastName: 'Elf',
				emailAddress: 'buddy.elf@example.com',
				zipCode: '80205',
			}),
			setDocument(COLLECTION_SCHEMA.parameters, 'public', {
				registrationEnabled: true,
				admin: {
					preRegistrationEnabled: true,
					allowChangeRegistration: true,
				},
			}),
			setDocument(COLLECTION_SCHEMA.dateTimeSlots, 'slot-1', {
				programYear: 2025,
				enabled: true,
				maxSlots: 3,
				slotsReserved: 0,
				dateTime: new Date('2025-12-10T18:00:00.000Z'),
			}),
		]);
		await setDraftAppointment(
			createCallableRequest(
				{
					mutationId: 'initial-selection',
					slotId: 'slot-1',
					reviewedDateTime: '2025-12-10T18:00:00.000Z',
				},
				{ uid: 'boundary-user' },
			),
		);
	};

	it.each([
		'disabled',
		'deleted',
		'moved',
		'wrong-year',
		'invalid-time',
		'full',
		'at-cutoff',
		'after-cutoff',
	])(
		'rejects %s after selection without changing the draft or publishing side effects',
		async (state) => {
			await seedBooking();
			const ref = getFirestore().doc('dateTimeSlots/slot-1');
			const before = await getDocument(
				COLLECTION_SCHEMA.registrations,
				'boundary-user',
			);
			if (state === 'disabled') await ref.update({ enabled: false });
			if (state === 'deleted') await ref.delete();
			if (state === 'moved')
				await ref.update({
					dateTime: new Date('2025-12-11T18:00:00.000Z'),
				});
			if (state === 'wrong-year') await ref.update({ programYear: 2024 });
			if (state === 'invalid-time')
				await ref.update({ dateTime: 'invalid' });
			if (state === 'full') await ref.update({ slotsReserved: 3 });
			if (state === 'at-cutoff' || state === 'after-cutoff')
				vi.mocked(Date.now).mockReturnValue(
					Date.parse('2025-12-10T18:00:00.000Z') +
						(state === 'after-cutoff' ? 1 : 0),
				);
			await expect(
				completeRegistration(
					createCallableRequest(
						{ mutationId: 'rejected-completion' },
						{ uid: 'boundary-user' },
					),
				),
			).rejects.toMatchObject({
				details: { reason: 'appointment-review-required' },
			});
			expect(
				await getDocument(
					COLLECTION_SCHEMA.registrations,
					'boundary-user',
				),
			).toEqual(before);
			expect(
				(
					await getFirestore()
						.collection(COLLECTION_SCHEMA.tmpRegistrationEmails)
						.get()
				).size,
			).toBe(0);
			expect(
				(
					await getFirestore()
						.collection(COLLECTION_SCHEMA.registrationSearchIndex)
						.get()
				).size,
			).toBe(0);
			expect(
				(
					await getFirestore()
						.doc(
							'registrations/boundary-user/mutationReceipts/rejected-completion',
						)
						.get()
				).exists,
			).toBe(false);
		},
	);

	it.each(['2025-12-10T17:59:59.999Z', '2025-12-10T07:00:00.000Z'])(
		'reconfirms an old future selection at %s and durably replays after cutoff and closure',
		async (now) => {
			await seedBooking();
			vi.mocked(Date.now).mockReturnValue(Date.parse(now));
			await setDraftAppointment(
				createCallableRequest(
					{
						mutationId: 'fresh-selection',
						slotId: 'slot-1',
						reviewedDateTime: '2025-12-10T18:00:00.000Z',
					},
					{ uid: 'boundary-user' },
				),
			);
			const request = createCallableRequest(
				{ mutationId: 'durable-completion' },
				{ uid: 'boundary-user' },
			);
			await expect(completeRegistration(request)).resolves.toBe(true);
			const original = await getDocument(
				COLLECTION_SCHEMA.registrations,
				'boundary-user',
			);
			const receipt = await getFirestore()
				.doc(
					'registrations/boundary-user/mutationReceipts/durable-completion',
				)
				.get();
			expect(receipt.data()).toMatchObject({
				operation: 'completeRegistration',
				result: true,
			});
			vi.mocked(Date.now).mockReturnValue(
				Date.parse('2025-12-12T00:00:00.000Z'),
			);
			await getFirestore()
				.doc('dateTimeSlots/slot-1')
				.update({ enabled: false });
			await setDocument(COLLECTION_SCHEMA.parameters, 'public', {
				registrationEnabled: false,
			});
			await expect(completeRegistration(request)).resolves.toBe(true);
			expect(
				await getDocument(
					COLLECTION_SCHEMA.registrations,
					'boundary-user',
				),
			).toEqual(original);
			expect(
				(await getFirestore().doc(receipt.ref.path).get()).data(),
			).toEqual(receipt.data());
			expect(
				(
					await getFirestore()
						.collection(COLLECTION_SCHEMA.registrations)
						.get()
				).size,
			).toBe(1);
			expect(
				(
					await getFirestore()
						.collection(COLLECTION_SCHEMA.tmpRegistrationEmails)
						.get()
				).size,
			).toBe(1);
			expect(
				(
					await getFirestore()
						.collection(COLLECTION_SCHEMA.registrationSearchIndex)
						.get()
				).size,
			).toBe(1);
			await setDocument(
				COLLECTION_SCHEMA.registrations,
				'new-draft',
				createRegistration({ uid: 'new-draft' }),
			);
			await expect(
				completeRegistration(
					createCallableRequest(
						{ mutationId: 'new-invalid-submit' },
						{ uid: 'new-draft' },
					),
				),
			).rejects.toMatchObject({ code: 'failed-precondition' });
		},
	);

	it('requires visible reconfirmation when an operator moves the selected slot', async () => {
		await seedBooking();
		await getFirestore()
			.doc('dateTimeSlots/slot-1')
			.update({ dateTime: new Date('2025-12-11T18:00:00.000Z') });
		await expect(
			setDraftAppointment(
				createCallableRequest(
					{
						mutationId: 'stale-review-001',
						slotId: 'slot-1',
						reviewedDateTime: '2025-12-10T18:00:00.000Z',
					},
					{ uid: 'boundary-user' },
				),
			),
		).rejects.toMatchObject({
			details: { reason: 'appointment-review-required' },
		});
		await setDraftAppointment(
			createCallableRequest(
				{
					mutationId: 'new-review-0001',
					slotId: 'slot-1',
					reviewedDateTime: '2025-12-11T18:00:00.000Z',
				},
				{ uid: 'boundary-user' },
			),
		);
		await expect(
			completeRegistration(
				createCallableRequest(
					{ mutationId: 'new-time-submit' },
					{ uid: 'boundary-user' },
				),
			),
		).resolves.toBe(true);
	});

	it.each([-1, 0, 1])(
		'uses the server instant for new selection and customer reschedule at cutoff %+d ms',
		async (offset) => {
			await seedBooking();
			await setDocument(COLLECTION_SCHEMA.dateTimeSlots, 'target', {
				enabled: true,
				programYear: 2025,
				maxSlots: 5,
				dateTime: new Date('2025-12-11T07:00:00.000Z'),
			});
			vi.mocked(Date.now).mockReturnValue(
				Date.parse('2025-12-11T07:00:00.000Z') + offset,
			);
			const selection = setDraftAppointment(
				createCallableRequest(
					{ mutationId: 'cutoff-selection', slotId: 'target' },
					{ uid: 'boundary-user' },
				),
			);
			if (offset < 0) await expect(selection).resolves.toBe(true);
			else
				await expect(selection).rejects.toMatchObject({
					details: { reason: 'appointment-review-required' },
				});
			await getFirestore()
				.doc('registrations/boundary-user')
				.update({
					registrationSubmittedOn: new Date('2025-12-01'),
					dateTimeSlot: {
						id: 'slot-1',
						dateTime: new Date('2025-12-10T18:00:00.000Z'),
					},
				});
			const change = changeRegistrationDateTime(
				createCallableRequest(
					{ mutationId: 'cutoff-reschedule', slotId: 'target' },
					{ uid: 'boundary-user' },
				),
			);
			if (offset < 0) await expect(change).resolves.toBe(true);
			else
				await expect(change).rejects.toMatchObject({
					details: { reason: 'appointment-review-required' },
				});
		},
	);

	it('completes a registration and writes email/search index records', async () => {
		const record = createRegistration({ uid: 'user-reg-1' });
		await Promise.all([
			setDocument(COLLECTION_SCHEMA.registrations, 'user-reg-1', record),
			setDocument(COLLECTION_SCHEMA.users, 'user-reg-1', {
				firstName: 'Buddy',
				lastName: 'Elf',
				emailAddress: 'buddy.elf@example.com',
				zipCode: '80205',
			}),
			setDocument(COLLECTION_SCHEMA.parameters, 'public', {
				registrationEnabled: true,
				admin: { preRegistrationEnabled: true },
			}),
			setDocument(COLLECTION_SCHEMA.dateTimeSlots, 'slot-1', {
				programYear: 2025,
				enabled: true,
				maxSlots: 10,
				dateTime: new Date('2025-12-10T18:00:00.000Z'),
			}),
		]);

		const result = await completeRegistration(
			createCallableRequest(
				{ mutationId: 'submit-reg-0001' },
				{ uid: 'user-reg-1' },
			),
		);

		expect(result).toBe(true);
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrations,
				'user-reg-1',
			),
		).toMatchObject({
			programYear: 2025,
			includedInCounts: false,
			includedInRegistrationStats: false,
		});
		const queuedEmails = await getFirestore()
			.collection(COLLECTION_SCHEMA.tmpRegistrationEmails)
			.where('registrationUid', '==', 'user-reg-1')
			.get();
		expect(queuedEmails.size).toBe(1);
		expect(queuedEmails.docs[0]?.data()).toMatchObject({
			registrationUid: 'user-reg-1',
			code: 'ABCD2345',
			email: 'buddy.elf@example.com',
			name: 'Buddy',
			queueSource: 'registration-completion',
		});
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrationSearchIndex,
				'user-reg-1',
			),
		).toMatchObject({ customerId: 'user-reg-1', code: 'ABCD2345' });
		const slot = await getDocument<Record<string, unknown>>(
			COLLECTION_SCHEMA.dateTimeSlots,
			'slot-1',
		);
		expect(slot?.['slotsReserved']).toBeUndefined();
		expect(slot?.['enabled']).toBe(true);
	});

	it('allows a small concurrent overage and reconciles it on the delayed counter run', async () => {
		const submissionCount = 5;
		const slotCapacity = 3;
		await Promise.all([
			setDocument(COLLECTION_SCHEMA.parameters, 'public', {
				registrationEnabled: true,
				maintenanceModeEnabled: false,
				weatherModeEnabled: false,
				admin: { preRegistrationEnabled: true },
			}),
			setDocument(COLLECTION_SCHEMA.dateTimeSlots, 'spike-slot', {
				programYear: 2025,
				enabled: true,
				maxSlots: slotCapacity,
				slotsReserved: 0,
				dateTime: new Date('2025-12-10T18:00:00.000Z'),
			}),
		]);

		await Promise.all(
			Array.from({ length: submissionCount }, async (_, index) => {
				const uid = `spike-user-${index}`;
				const emailAddress = `spike-${index}@example.com`;
				await Promise.all([
					setDocument(
						COLLECTION_SCHEMA.registrations,
						uid,
						createRegistration({
							uid,
							emailAddress,
							qrcode: `Q${index.toString().padStart(7, '0')}`,
							dateTimeSlot: {
								id: 'spike-slot',
								dateTime: '2025-12-10T18:00:00.000Z',
							},
						}),
					),
					setDocument(COLLECTION_SCHEMA.users, uid, {
						firstName: 'Spike',
						lastName: `Customer${index}`,
						emailAddress,
						zipCode: '80205',
					}),
				]);
			}),
		);

		await Promise.all(
			Array.from({ length: submissionCount }, (_, index) => {
				const uid = `spike-user-${index}`;
				return completeRegistration(
					createCallableRequest(
						{
							mutationId: `spike-submit-${index.toString().padStart(4, '0')}`,
						},
						{ uid },
					),
				);
			}),
		);

		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.dateTimeSlots,
				'spike-slot',
			),
		).toMatchObject({ slotsReserved: 0, enabled: true });

		await scheduledDateTimeSlotCounters();

		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.dateTimeSlots,
				'spike-slot',
			),
		).toMatchObject({ slotsReserved: submissionCount, enabled: true });
	});
});
