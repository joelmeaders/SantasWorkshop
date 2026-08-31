import { beforeEach, describe, expect, it } from 'vitest';
import completeRegistration from '../../src/fn/completeRegistration';
import scheduledDateTimeSlotCounters from '../../src/fn/scheduledDateTimeSlotCounters2';
import { COLLECTION_SCHEMA } from '@santashop/models';
import { createRegistration } from '../fixtures/factories';
import {
	clearEmulatorData,
	getDocument,
	setDocument,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';

describe.sequential('completeRegistration integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

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
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.tmpRegistrationEmails,
				'user-reg-1',
			),
		).toMatchObject({
			code: 'ABCD2345',
			email: 'buddy.elf@example.com',
			name: 'Buddy',
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
		const submissionCount = 200;
		const slotCapacity = 198;
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

		await Promise.all(Array.from({ length: submissionCount }, async (_, index) => {
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
		}));

		await Promise.all(Array.from({ length: submissionCount }, (_, index) => {
			const uid = `spike-user-${index}`;
			return completeRegistration(createCallableRequest(
				{ mutationId: `spike-submit-${index.toString().padStart(4, '0')}` },
				{ uid },
			));
		}));

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
		).toMatchObject({ slotsReserved: submissionCount, enabled: false });
	});
});
