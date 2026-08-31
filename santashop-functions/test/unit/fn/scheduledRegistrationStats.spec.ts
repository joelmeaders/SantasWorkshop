import { beforeEach, describe, expect, it } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import {
	loadTriggerScheduledHandlers,
	type TriggerScheduledAdminMock,
} from '../helpers/trigger-scheduled.unit-helper';

describe('scheduledRegistrationStats handler', () => {
	let backgroundMock: TriggerScheduledAdminMock;

	beforeEach(() => {
		backgroundMock = createBackgroundAdminMock();
		backgroundMock.batchCommit.mockResolvedValue(undefined);
		backgroundMock.exportDocuments.mockResolvedValue([{ name: 'op-123' }]);
	});

	it('aggregates registration stats and writes them to the stats collection', async () => {
		const { scheduledRegistrationStats } =
			await loadTriggerScheduledHandlers(backgroundMock);
		backgroundMock.setCollectionDocs('registrations', [
			{
				id: 'reg-1',
				data: {
					uid: 'reg-1',
					programYear: 2025,
					zipCode: '80205',
					children: [{ toyType: 'girls', ageGroup: '3-5' }],
					dateTimeSlot: {
						dateTime: {
							toDate: () => new Date('2025-12-10T18:00:00.000Z'),
						},
					},
				},
			},
		]);
		backgroundMock
			.getDocRef('stats/registration-2025')
			.set.mockResolvedValue(undefined);

		await scheduledRegistrationStats();

		expect(
			backgroundMock.getDocRef('stats/registration-2025').set,
		).toHaveBeenCalledTimes(1);
	});

	it('combines matching appointment and ZIP buckets while skipping incomplete appointments', async () => {
		const { scheduledRegistrationStats } =
			await loadTriggerScheduledHandlers(backgroundMock);
		const dateTime = new Date('2025-12-10T18:00:00.000Z');
		backgroundMock.setCollectionDocs('registrations', [
			{
				id: 'reg-1',
				data: {
					uid: 'reg-1', programYear: 2025, zipCode: '80205-1111',
					children: [{ toyType: 'girls', ageGroup: '3-5' }],
					dateTimeSlot: { dateTime },
				},
			},
			{
				id: 'reg-2',
				data: {
					uid: 'reg-2', programYear: 2025, zipCode: 80205,
					children: [{ toyType: 'boys', ageGroup: '6-8' }, { toyType: 'girls' }],
					dateTimeSlot: { dateTime },
				},
			},
			{
				id: 'missing-slot',
				data: { uid: 'missing-slot', programYear: 2025, children: [] },
			},
		]);

		await scheduledRegistrationStats();

		expect(backgroundMock.getDocRef('stats/registration-2025').set).toHaveBeenCalledWith(
			expect.objectContaining({
				completedRegistrations: 3,
				dateTimeCount: [expect.objectContaining({ count: 2, childCount: 3 })],
				zipCodeCount: [expect.objectContaining({ zip: 80205, count: 2, childCount: 3 })],
			}),
			{ merge: false },
		);
	});
});
