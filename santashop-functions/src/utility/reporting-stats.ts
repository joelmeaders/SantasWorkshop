import {
	getZonedDateKey,
	type DailyProfileCount,
	type Registration,
	type RegistrationDailySnapshot,
	type RegistrationOperationalStats,
} from '../models';

/** Read dates from older JSON exports and current Firestore snapshots without inventing dates. */
export const readStatsDate = (value: unknown): Date | undefined => {
	let date: unknown = value;
	if (typeof value === 'string' && value.trim()) date = new Date(value);
	if (value && typeof value === 'object' && 'toDate' in value) {
		try {
			date =
				typeof value.toDate === 'function' ? value.toDate() : undefined;
		} catch {
			return undefined;
		}
	}
	return date instanceof Date && Number.isFinite(date.getTime())
		? date
		: undefined;
};

export interface ReportingRegistration {
	id: string;
	data: Registration;
}

export const calculateOperationalStats = (
	registrations: ReportingRegistration[],
	checkedInIds: ReadonlySet<string>,
	recordedCancellationEvents: number,
	programYear: number,
	timeZone: string,
	now: Date,
): RegistrationOperationalStats => {
	const today = getZonedDateKey(now, timeZone);
	const records = registrations.filter(
		({ data }) => data.programYear === programYear,
	);
	const stats: RegistrationOperationalStats = {
		coverage: 'current-records',
		registrationRecords: records.length,
		submittedRegistrations: 0,
		draftRegistrations: 0,
		cancelledRegistrations: 0,
		recordedCancellationEvents,
		checkedInRegistrations: 0,
		pastAppointmentRegistrations: 0,
		attendedPastAppointments: 0,
		unconfirmedPastAppointments: 0,
		attendanceStatusUnavailable: 0,
		missingAppointmentRegistrations: 0,
		invalidSubmissionDates: 0,
	};
	for (const { id, data } of records) {
		if (data.cancelledOn) {
			stats.cancelledRegistrations += 1;
			continue;
		}
		const submittedOn = readStatsDate(data.registrationSubmittedOn);
		if (!submittedOn || submittedOn > now) {
			if (data.registrationSubmittedOn) stats.invalidSubmissionDates += 1;
			else stats.draftRegistrations += 1;
			continue;
		}
		stats.submittedRegistrations += 1;
		const checkedIn = data.hasCheckedIn === true || checkedInIds.has(id);
		if (checkedIn) stats.checkedInRegistrations += 1;
		const appointment = readStatsDate(data.dateTimeSlot?.dateTime);
		if (
			!appointment ||
			!getZonedDateKey(appointment, timeZone).startsWith(
				`${programYear}-`,
			)
		) {
			stats.missingAppointmentRegistrations += 1;
			continue;
		}
		if (getZonedDateKey(appointment, timeZone) >= today) continue;
		stats.pastAppointmentRegistrations += 1;
		if (checkedIn) stats.attendedPastAppointments += 1;
		else {
			stats.unconfirmedPastAppointments += 1;
			if (typeof data.hasCheckedIn !== 'boolean')
				stats.attendanceStatusUnavailable += 1;
		}
	}
	if (stats.registrationRecords && !stats.invalidSubmissionDates) {
		stats.completionRate =
			stats.submittedRegistrations / stats.registrationRecords;
	}
	if (
		stats.pastAppointmentRegistrations &&
		!stats.attendanceStatusUnavailable
	) {
		stats.attendanceRate =
			stats.attendedPastAppointments / stats.pastAppointmentRegistrations;
	}
	return stats;
};

/** Same-day retries cannot erase the first observation, including after an annual reset. */
export const appendDailyRegistrationSnapshot = (
	previous: RegistrationDailySnapshot[] | undefined,
	operational: RegistrationOperationalStats,
	programYear: number,
	timeZone: string,
	now: Date,
): RegistrationDailySnapshot[] => {
	const snapshots = [...(previous ?? [])];
	const dateKey = getZonedDateKey(now, timeZone);
	// The annual document has at most one new snapshot per day of its program year.
	if (
		dateKey.startsWith(`${programYear}-`) &&
		!snapshots.some((entry) => entry.dateKey === dateKey)
	) {
		snapshots.push({ ...operational, dateKey, calculatedAt: now });
	}
	return snapshots.sort((left, right) =>
		left.dateKey.localeCompare(right.dateKey),
	);
};

/** Counts are observed lower bounds; deletions cannot remove previously observed daily totals. */
export const mergeDailyProfileCounts = (
	previous: DailyProfileCount[] | undefined,
	current: DailyProfileCount[],
): DailyProfileCount[] => {
	const counts = new Map<string, number>();
	for (const entry of [...(previous ?? []), ...current]) {
		counts.set(
			entry.dateKey,
			Math.max(counts.get(entry.dateKey) ?? 0, entry.count),
		);
	}
	return [...counts]
		.map(([dateKey, count]) => ({ dateKey, count }))
		.sort((left, right) => left.dateKey.localeCompare(right.dateKey));
};
