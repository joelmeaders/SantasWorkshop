import { describe, expect, it } from 'vitest';
import type { Registration } from '../../../src/models';
import {
	appendDailyRegistrationSnapshot,
	calculateOperationalStats,
	mergeDailyProfileCounts,
	readStatsDate,
	type ReportingRegistration,
} from '../../../src/utility/reporting-stats';

const now = new Date('2025-12-11T19:00:00Z');
const submitted = new Date('2025-11-10T12:00:00Z');
const past = new Date('2025-12-10T19:00:00Z');
const today = new Date('2025-12-11T18:00:00Z');
const registration = (
	id: string,
	data: Partial<Registration> = {},
): ReportingRegistration => ({
	id,
	data: { qrCodeStoragePath: '', programYear: 2025, ...data },
});
const calculate = (
	records: ReportingRegistration[],
	checkedInIds: string[] = [],
) =>
	calculateOperationalStats(
		records,
		new Set(checkedInIds),
		2,
		2025,
		'America/Denver',
		now,
	);

describe('reporting statistics compatibility and cohort definitions', () => {
	it('keeps draft, cancelled, submitted and invalid-date cohorts separate and excludes other years', () => {
		const stats = calculate([
			registration('draft'),
			registration('cancelled', { cancelledOn: past }),
			registration('completed', { registrationSubmittedOn: submitted }),
			registration('invalid', {
				registrationSubmittedOn: 'unknown' as unknown as Date,
			}),
			registration('missing-year', {
				programYear: undefined,
				registrationSubmittedOn: submitted,
			}),
			registration('other-year', {
				programYear: 2024,
				registrationSubmittedOn: submitted,
			}),
		]);
		expect(stats).toMatchObject({
			registrationRecords: 4,
			submittedRegistrations: 1,
			draftRegistrations: 1,
			cancelledRegistrations: 1,
			invalidSubmissionDates: 1,
			missingAppointmentRegistrations: 1,
			recordedCancellationEvents: 2,
		});
		expect(stats.completionRate).toBeUndefined();
		expect(stats.attendanceRate).toBeUndefined();
	});

	it('calculates completion from all retained current-year registrations including cancelled drafts', () => {
		const stats = calculate([
			registration('draft'),
			registration('cancelled', { cancelledOn: past }),
			registration('submitted', { registrationSubmittedOn: submitted }),
			registration('checked-in', {
				registrationSubmittedOn: submitted,
				hasCheckedIn: true,
			}),
		]);
		expect(stats.completionRate).toBe(0.5);
		expect(stats.checkedInRegistrations).toBe(1);
	});

	it('counts only appointments before today and suppresses attendance rates for unknown legacy statuses', () => {
		const pastRegistration = {
			registrationSubmittedOn: submitted,
			dateTimeSlot: { dateTime: past },
		};
		const stats = calculate(
			[
				registration('confirmed', {
					...pastRegistration,
					hasCheckedIn: true,
				}),
				registration('unchecked', {
					...pastRegistration,
					hasCheckedIn: false,
				}),
				registration('unknown', pastRegistration),
				registration('legacy-checkin', pastRegistration),
				registration('today', {
					registrationSubmittedOn: submitted,
					dateTimeSlot: { dateTime: today },
				}),
				registration('cancelled', {
					...pastRegistration,
					cancelledOn: past,
				}),
			],
			['legacy-checkin'],
		);
		expect(stats).toMatchObject({
			pastAppointmentRegistrations: 4,
			attendedPastAppointments: 2,
			unconfirmedPastAppointments: 2,
			attendanceStatusUnavailable: 1,
		});
		expect(stats.attendanceRate).toBeUndefined();
	});

	it('uses a matching known cohort for attendance rates and no rate for an empty cohort', () => {
		const pastRegistration = {
			registrationSubmittedOn: submitted,
			dateTimeSlot: { dateTime: past },
		};
		const stats = calculate([
			registration('confirmed', {
				...pastRegistration,
				hasCheckedIn: true,
			}),
			registration('unchecked', {
				...pastRegistration,
				hasCheckedIn: false,
			}),
		]);
		expect(stats.attendanceRate).toBe(0.5);
		expect(calculate([]).attendanceRate).toBeUndefined();
		expect(calculate([]).completionRate).toBeUndefined();
	});

	it('accepts stored Firestore timestamps and ISO dates but rejects invalid or future submission dates', () => {
		expect(readStatsDate({ toDate: () => submitted })).toEqual(submitted);
		expect(readStatsDate(submitted.toISOString())).toEqual(submitted);
		for (const value of [
			'',
			false,
			0,
			{},
			new Date('invalid'),
			{
				toDate: () => {
					throw new Error();
				},
			},
		]) {
			expect(readStatsDate(value)).toBeUndefined();
		}
		const stats = calculate([
			registration('future', {
				registrationSubmittedOn: new Date('2026-01-01'),
			}),
		]);
		expect(stats.invalidSubmissionDates).toBe(1);
		expect(stats.completionRate).toBeUndefined();
	});
});

describe('durable daily observations', () => {
	it('starts history at the first observation and never rewrites the same day after a reset', () => {
		const observed = calculate([
			registration('submitted', { registrationSubmittedOn: submitted }),
		]);
		const first = appendDailyRegistrationSnapshot(
			undefined,
			observed,
			2025,
			'America/Denver',
			now,
		);
		expect(first).toHaveLength(1);
		expect(first[0]).toMatchObject({
			dateKey: '2025-12-11',
			submittedRegistrations: 1,
			calculatedAt: now,
		});
		const afterReset = appendDailyRegistrationSnapshot(
			first,
			calculate([]),
			2025,
			'America/Denver',
			now,
		);
		expect(afterReset).toEqual(first);
		expect(first).toHaveLength(1);
	});

	it('appends later observations in local date order and cannot grow the annual report outside its year', () => {
		const first = appendDailyRegistrationSnapshot(
			undefined,
			calculate([]),
			2025,
			'America/Denver',
			now,
		);
		const next = appendDailyRegistrationSnapshot(
			first,
			calculate([]),
			2025,
			'America/Denver',
			new Date('2025-12-13T01:00:00Z'),
		);
		expect(next.map(({ dateKey }) => dateKey)).toEqual([
			'2025-12-11',
			'2025-12-12',
		]);
		expect(
			appendDailyRegistrationSnapshot(
				next,
				calculate([]),
				2025,
				'America/Denver',
				new Date('2026-02-01T00:00:00Z'),
			),
		).toEqual(next);
	});

	it('keeps observed profile counts through repeated runs and missing source records', () => {
		const first = mergeDailyProfileCounts(undefined, [
			{ dateKey: '2025-11-01', count: 2 },
		]);
		expect(mergeDailyProfileCounts(first, [])).toEqual(first);
		expect(
			mergeDailyProfileCounts(first, [
				{ dateKey: '2025-11-01', count: 1 },
			]),
		).toEqual(first);
		expect(
			mergeDailyProfileCounts(first, [
				{ dateKey: '2025-11-01', count: 3 },
			]),
		).toEqual([{ dateKey: '2025-11-01', count: 3 }]);
	});
});
