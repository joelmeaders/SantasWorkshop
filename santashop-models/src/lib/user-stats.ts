export interface UserStats {
	/** Optional on reports calculated before schema version 2. */
	schemaVersion?: number;
	calculatedAt?: Date;
	programYear?: number;
	population?: 'all-users';
	signupCoverage?: 'observed-profile-records';
	/** Maximum observed stored profiles per creation day; not an Auth signup total. */
	dailySignups?: DailyProfileCount[];
	signupDatesUnavailable?: number;
	signupDatesOutsideProgramYear?: number;
	totalUsers: number;

	zipCodeCount: UsersByZipCodeCount[];

	referrerCount: ReferrerCount[];
}

export interface DailyProfileCount {
	dateKey: string;
	count: number;
}

export interface UsersByZipCodeCount {
	zip: string;
	count: number;
}
export interface ReferrerCount {
	referrer: string;
	count: number;
}
