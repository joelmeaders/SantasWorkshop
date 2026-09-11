import { beforeEach, describe, expect, it } from 'vitest';
import scheduledDateTimeSlotCounters from '../../src/fn/reconcileAppointmentCounters';
import { requireEnabledCurrentSlot } from '../../src/fn/registrationMutationSupport';
import type { DateTimeSlot } from '@santashop/models';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	createTimestamp,
	getDocument,
	setDocument,
	getFirestore,
} from '../helpers/admin-emulator';

describe.sequential('reconcileAppointmentCounters integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('retains operator closure and derives current capacity even when counts do not change', async () => {
		const now = new Date('2025-12-10T18:00:00.000Z');
		for (const [id, enabled, dateTime] of [
			['closed', false, '2025-12-11T18:00:00.000Z'],
			['expired', true, '2025-12-10T18:00:00.000Z'],
			['capacity', true, '2025-12-11T18:00:00.000Z'],
		] as const) {
			await setDocument(COLLECTION_SCHEMA.dateTimeSlots, id, {
				programYear: 2025,
				enabled,
				dateTime: new Date(dateTime),
				maxSlots: id === 'closed' ? 5 : 1,
				slotsReserved: 0,
			});
			await setDocument(COLLECTION_SCHEMA.registrations, id, {
				registrationSubmittedOn: new Date('2025-12-01'),
				dateTimeSlot: { id },
			});
		}
		await scheduledDateTimeSlotCounters();
		const readSlot = async (id: string): Promise<DateTimeSlot> =>
			(
				await getFirestore().doc(`dateTimeSlots/${id}`).get()
			).data() as DateTimeSlot;
		expect(await readSlot('closed')).toMatchObject({
			enabled: false,
			slotsReserved: 1,
		});
		await getFirestore()
			.doc('dateTimeSlots/expired')
			.update({ maxSlots: 2 });
		await getFirestore()
			.doc('dateTimeSlots/capacity')
			.update({ maxSlots: 2 });
		await scheduledDateTimeSlotCounters();
		expect(() =>
			requireEnabledCurrentSlot(undefined, 'deleted', now),
		).toThrow();
		const closed = await readSlot('closed');
		const expired = await readSlot('expired');
		expect(() =>
			requireEnabledCurrentSlot(closed, 'closed', now),
		).toThrow();
		expect(() =>
			requireEnabledCurrentSlot(expired, 'expired', now),
		).toThrow();
		expect(
			requireEnabledCurrentSlot(
				await readSlot('capacity'),
				'capacity',
				now,
			),
		).toMatchObject({ maxSlots: 2, enabled: true });
		await getFirestore()
			.doc('dateTimeSlots/capacity')
			.update({ maxSlots: 1 });
		await scheduledDateTimeSlotCounters();
		const full = await readSlot('capacity');
		expect(full).toMatchObject({ slotsReserved: 1, enabled: true });
		expect(() =>
			requireEnabledCurrentSlot(full, 'capacity', now),
		).toThrow();
	});

	it('updates slot counters and schedule stats from submitted registrations', async () => {
		await setDocument(COLLECTION_SCHEMA.dateTimeSlots, 'slot-1', {
			programYear: 2025,
			dateTime: createTimestamp('2025-12-10T18:00:00.000Z'),
			maxSlots: 10,
			slotsReserved: 0,
			enabled: true,
		});
		await setDocument(COLLECTION_SCHEMA.registrations, 'reg-1', {
			uid: 'reg-1',
			registrationSubmittedOn: createTimestamp(
				'2025-12-01T00:00:00.000Z',
			),
			dateTimeSlot: { id: 'slot-1' },
		});
		await setDocument(COLLECTION_SCHEMA.registrations, 'reg-2', {
			uid: 'reg-2',
			registrationSubmittedOn: createTimestamp(
				'2025-12-01T00:00:00.000Z',
			),
			dateTimeSlot: { id: 'slot-1' },
		});

		const result = await scheduledDateTimeSlotCounters();

		expect(result).toBe('Updated date time slots');
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.dateTimeSlots,
				'slot-1',
			),
		).toMatchObject({ slotsReserved: 2, enabled: true });
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.stats,
				'schedule-2025',
			),
		).toMatchObject({ dateTimeCounts: [{ count: 2 }] });
	});
});
