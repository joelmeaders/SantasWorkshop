export interface RegistrationStats {
	/** Optional on reports calculated before schema version 2. */
	schemaVersion?: number;
	calculatedAt?: Date;
	programYear?: number;
	operational?: RegistrationOperationalStats;
	/** First observation per local calendar day, retained when source records reset. */
	dailySnapshots?: RegistrationDailySnapshot[];
	completedRegistrations: number;

	dateTimeCount: RegistrationDateTimeStats[];

	zipCodeCount: ZipCodeCount[];
}

/** Point-in-time counts of retained records explicitly assigned to the program year. */
export interface RegistrationOperationalStats {
	coverage: 'current-records';
	registrationRecords: number;
	submittedRegistrations: number;
	draftRegistrations: number;
	cancelledRegistrations: number;
	recordedCancellationEvents: number;
	checkedInRegistrations: number;
	/** Submitted, non-cancelled appointments before today's local calendar date. */
	pastAppointmentRegistrations: number;
	attendedPastAppointments: number;
	/** No confirmed attendance; this is not a proven no-show count. */
	unconfirmedPastAppointments: number;
	attendanceStatusUnavailable: number;
	missingAppointmentRegistrations: number;
	invalidSubmissionDates: number;
	/** Submitted / all retained registration records; not a historical signup funnel. */
	completionRate?: number;
	/** Present only when every past appointment has an explicit attendance status. */
	attendanceRate?: number;
}

export interface RegistrationDailySnapshot extends RegistrationOperationalStats {
	dateKey: string;
	calculatedAt: Date;
}

/** Nightly registration and child demographics grouped by appointment time. */
export interface RegistrationDateTimeStats {
	dateTime: Date;
	count: number;
	childCount: number;
	stats: GenderAgeStats;
}

export interface ZipCodeCount {
	zip: number;
	count: number;
	childCount: number;
}

export interface GenderAgeStats {
	infants: AgeGroupBreakdown;
	girls: AgeGroupBreakdown;
	boys: AgeGroupBreakdown;
}

export interface AgeGroupBreakdown {
	total: number;
	age02: number;
	age35: number;
	age68: number;
	age911: number;
}

export interface IGenderAgeStatsDisplay {
	date: Date;
	stats: GenderAgeStats;
}
