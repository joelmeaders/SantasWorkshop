export interface RegistrationStats {
	completedRegistrations: number;

	dateTimeCount: DateTimeCount[];

	zipCodeCount: ZipCodeCount[];
}

export interface DateTimeCount {
	// TODO: Remove after 2023. Replaced by ScheduleStats.
	dateTime: Date;
	// TODO: Remove after 2023. Replaced by ScheduleStats.
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
