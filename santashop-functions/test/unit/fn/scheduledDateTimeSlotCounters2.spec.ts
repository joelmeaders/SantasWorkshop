import { beforeEach, describe, expect, it } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import {
	loadTriggerScheduledHandlers,
	type TriggerScheduledAdminMock,
} from '../helpers/trigger-scheduled.unit-helper';

describe('scheduledDateTimeSlotCounters2 handler', () => {
	let backgroundMock: TriggerScheduledAdminMock;

	beforeEach(() => {
		backgroundMock = createBackgroundAdminMock();
		backgroundMock.batchCommit.mockResolvedValue(undefined);
		backgroundMock.exportDocuments.mockResolvedValue([{ name: 'op-123' }]);
	});

	it('updates slot counts and writes schedule stats', async () => {
		const { scheduledDateTimeSlotCounters } =
			await loadTriggerScheduledHandlers(backgroundMock);
		backgroundMock.setCollectionDocs('dateTimeSlots', [
			{
				id: 'slot-1',
				data: {
					programYear: 2025,
					dateTime: new Date('2025-12-10T18:00:00.000Z'),
					maxSlots: 10,
					slotsReserved: 0,
					enabled: true,
				},
			},
		]);
		backgroundMock.setCollectionCount('registrations', 2);
		backgroundMock
			.getDocRef('dateTimeSlots/slot-1')
			.update.mockResolvedValue(undefined);
		backgroundMock
			.getDocRef('stats/schedule-2025')
			.set.mockResolvedValue(undefined);

		const result = await scheduledDateTimeSlotCounters();

		expect(result).toBe('Updated date time slots');
		expect(
			backgroundMock.getDocRef('dateTimeSlots/slot-1').update,
		).toHaveBeenCalledTimes(1);
	});

	it('loads more than one page of date time slots', async () => {
		const { scheduledDateTimeSlotCounters } =
			await loadTriggerScheduledHandlers(backgroundMock);

		const firstPage = Array.from({ length: 50 }, (_, index) => ({
			id: `slot-${index + 1}`,
			data: () => ({
				programYear: 2025,
				dateTime: new Date('2025-12-10T18:00:00.000Z'),
				maxSlots: 10,
				slotsReserved: 0,
				enabled: true,
			}),
		}));
		const secondPage = Array.from({ length: 5 }, (_, index) => ({
			id: `slot-${index + 51}`,
			data: () => ({
				programYear: 2025,
				dateTime: new Date('2025-12-11T18:00:00.000Z'),
				maxSlots: 10,
				slotsReserved: 0,
				enabled: true,
			}),
		}));

		const dateTimeSlotsCollection = backgroundMock.getCollectionRef(
			'dateTimeSlots',
		);
		dateTimeSlotsCollection.get
			.mockResolvedValueOnce({ docs: firstPage })
			.mockResolvedValueOnce({ docs: secondPage });
		backgroundMock.setCollectionCount('registrations', 1);
		backgroundMock
			.getDocRef('stats/schedule-2025')
			.set.mockResolvedValue(undefined);

		await scheduledDateTimeSlotCounters();

		expect(dateTimeSlotsCollection.get).toHaveBeenCalledTimes(2);
		expect(
			backgroundMock.getDocRef('dateTimeSlots/slot-55').update,
		).toHaveBeenCalledTimes(1);
	});
});
