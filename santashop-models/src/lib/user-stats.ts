export interface UserStats {
	totalUsers: number;

	zipCodeCount: UsersByZipCodeCount[];

	referrerCount: ReferrerCount[];
}

export interface UsersByZipCodeCount {
	zip: string;
	count: number;
}
export interface ReferrerCount {
	referrer: string;
	count: number;
}
