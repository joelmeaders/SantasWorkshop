import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
		backgroundMock.setCollectionDocs('checkins', []);
		backgroundMock.setCollectionDocs('cancellations', []);
	});

	afterEach(() => vi.useRealTimers());

	it('classifies submissions, attendance and cancellations using time after all source reads', async () => {
		const { scheduledRegistrationStats } =
			await loadTriggerScheduledHandlers(backgroundMock);
		const beforeRead = new Date('2025-12-11T12:00:00Z');
		const committedDuringRead = new Date('2025-12-11T12:00:01Z');
		const afterRead = new Date('2025-12-11T12:00:02Z');
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(beforeRead);
		backgroundMock
			.getCollectionRef('registrations')
			.get.mockImplementation(async () => {
				await Promise.resolve();
				vi.setSystemTime(afterRead);
				return {
					docs: [
						{
							id: 'submitted-during-read',
							data: () => ({
								programYear: 2025,
								registrationSubmittedOn: committedDuringRead,
								dateTimeSlot: {
									dateTime: new Date('2025-12-12T19:00:00Z'),
								},
							}),
						},
						{
							id: 'attended-during-read',
							data: () => ({
								programYear: 2025,
								registrationSubmittedOn: new Date(
									'2025-11-01T12:00:00Z',
								),
								dateTimeSlot: {
									dateTime: new Date('2025-12-10T19:00:00Z'),
								},
							}),
						},
					],
				};
			});
		backgroundMock.setCollectionDocs('checkins', [
			{
				id: 'attended-during-read',
				data: {
					registrationCode: 'preregistered',
					checkInDateTime: committedDuringRead,
				},
			},
		]);
		backgroundMock.setCollectionDocs('cancellations', [
			{
				id: 'cancelled-during-read',
				data: { programYear: 2025, cancelledOn: committedDuringRead },
			},
		]);
		await scheduledRegistrationStats();
		const expectedCounts = {
			submittedRegistrations: 2,
			invalidSubmissionDates: 0,
			completionRate: 1,
			checkedInRegistrations: 1,
			recordedCancellationEvents: 1,
		};
		expect(
			backgroundMock.getDocRef('stats/registration-2025').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				calculatedAt: afterRead,
				operational: expect.objectContaining(expectedCounts),
				dailySnapshots: [
					expect.objectContaining({
						...expectedCounts,
						dateKey: '2025-12-11',
						calculatedAt: afterRead,
					}),
				],
			}),
			{ merge: false },
		);
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
					registrationSubmittedOn: new Date('2025-11-01T00:00:00Z'),
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
					uid: 'reg-1',
					programYear: 2025,
					zipCode: '80205-1111',
					registrationSubmittedOn: new Date('2025-11-01T00:00:00Z'),
					children: [{ toyType: 'girls', ageGroup: '3-5' }],
					dateTimeSlot: { dateTime },
				},
			},
			{
				id: 'reg-2',
				data: {
					uid: 'reg-2',
					programYear: 2025,
					zipCode: '80205',
					registrationSubmittedOn: new Date('2025-11-01T00:00:00Z'),
					children: [
						{ toyType: 'boys', ageGroup: '6-8' },
						{ toyType: 'girls' },
					],
					dateTimeSlot: { dateTime },
				},
			},
			{
				id: 'missing-slot',
				data: {
					uid: 'missing-slot',
					programYear: 2025,
					children: [],
					registrationSubmittedOn: new Date('2025-11-01T00:00:00Z'),
				},
			},
		]);

		await scheduledRegistrationStats();

		expect(
			backgroundMock.getDocRef('stats/registration-2025').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				completedRegistrations: 3,
				dateTimeCount: [
					expect.objectContaining({ count: 2, childCount: 3 }),
				],
				zipCodeCount: [
					expect.objectContaining({
						zip: 80205,
						count: 2,
						childCount: 3,
					}),
				],
			}),
			{ merge: false },
		);
	});

	it('keeps historical snapshots on a legacy report refresh with empty current records', async () => {
		const { scheduledRegistrationStats } =
			await loadTriggerScheduledHandlers(backgroundMock);
		backgroundMock.setCollectionDocs('registrations', []);
		const historical = {
			dateKey: '2025-12-10',
			submittedRegistrations: 5,
			calculatedAt: new Date('2025-12-10T23:00:00Z'),
		};
		backgroundMock.setDocSnapshot('stats/registration-2025', {
			completedRegistrations: 5,
			dateTimeCount: [],
			zipCodeCount: [],
			dailySnapshots: [historical],
		});
		await scheduledRegistrationStats();
		expect(
			backgroundMock.getDocRef('stats/registration-2025').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				schemaVersion: 2,
				calculatedAt: expect.any(Date),
				programYear: 2025,
				completedRegistrations: 0,
				dailySnapshots: expect.arrayContaining([historical]),
				operational: expect.objectContaining({
					registrationRecords: 0,
				}),
			}),
			{ merge: false },
		);
	});
});
