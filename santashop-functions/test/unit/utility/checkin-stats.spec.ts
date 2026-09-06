import { describe, expect, it } from 'vitest';
import type { CheckIn, CheckInAggregatedStats } from '../../../src/models';
import { addCheckInToAggregatedStats } from '../../../src/utility/checkin-stats';

const createCheckIn = (overrides: Partial<CheckIn> = {}): CheckIn => ({
	checkInDateTime: new Date('2026-12-12T17:15:00.000Z'),
	inStats: true,
	registrationCode: 'ABCD2345',
	stats: {
		preregistered: true,
		children: 2,
		ageGroup02: 0,
		ageGroup35: 1,
		ageGroup68: 1,
		ageGroup911: 0,
		toyTypeInfant: 0,
		toyTypeBoy: 1,
		toyTypeGirl: 1,
		zipCode: '80204',
		modifiedAtCheckIn: false,
	},
	...overrides,
});

describe('addCheckInToAggregatedStats', () => {
	it('creates the local-time bucket for a first check-in', () => {
		const now = new Date('2026-12-12T17:16:00.000Z');

		expect(
			addCheckInToAggregatedStats(undefined, createCheckIn(), now),
		).toEqual({
			lastUpdated: now,
			dateTimeCount: [
				{
					dateKey: '2026-12-12',
					date: 12,
					hour: 10,
					customerCount: 1,
					childCount: 2,
					pregisteredCount: 1,
					modifiedCount: 0,
				},
			],
		});
	});

	it('increments an existing bucket without mutating the current aggregate', () => {
		const current: CheckInAggregatedStats = {
			lastUpdated: new Date('2026-12-12T17:00:00.000Z'),
			dateTimeCount: [
				{
					date: 12,
					hour: 10,
					customerCount: 1,
					childCount: 2,
					pregisteredCount: 1,
					modifiedCount: 0,
				},
			],
		};

		const result = addCheckInToAggregatedStats(
			current,
			createCheckIn({
				registrationCode: 'onsite',
				stats: {
					...createCheckIn().stats!,
					children: 1,
					modifiedAtCheckIn: true,
				},
			}),
		);

		expect(result.dateTimeCount[0]).toMatchObject({
			dateKey: '2026-12-12',
			customerCount: 2,
			childCount: 3,
			pregisteredCount: 1,
			modifiedCount: 1,
		});
		expect(current.dateTimeCount[0]).not.toHaveProperty('dateKey');
		expect(current.dateTimeCount[0]).toMatchObject({
			customerCount: 1,
			childCount: 2,
		});
	});

	it('keeps a September check-in separate from a legacy December bucket', () => {
		const current: CheckInAggregatedStats = {
			lastUpdated: new Date('2026-12-05T17:00:00.000Z'),
			dateTimeCount: [
				{
					date: 5,
					hour: 10,
					customerCount: 2,
					childCount: 2,
					pregisteredCount: 2,
					modifiedCount: 0,
				},
			],
		};

		const result = addCheckInToAggregatedStats(
			current,
			createCheckIn({
				checkInDateTime: new Date('2026-09-05T16:15:00.000Z'),
			}),
		);

		expect(result.dateTimeCount).toHaveLength(2);
		expect(result.dateTimeCount[0]).not.toHaveProperty('dateKey');
		expect(result.dateTimeCount[1]).toMatchObject({
			dateKey: '2026-09-05',
			date: 5,
			hour: 10,
			customerCount: 1,
		});
	});

	it('rejects incomplete check-in data', () => {
		expect(() =>
			addCheckInToAggregatedStats(
				undefined,
				createCheckIn({ stats: undefined }),
			),
		).toThrow('Cannot aggregate an incomplete check-in record.');
	});
});
