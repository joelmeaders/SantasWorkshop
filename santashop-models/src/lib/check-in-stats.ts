export interface CheckInAggregatedStats {
	lastUpdated: Date;
	dateTimeCount: CheckInDateTimeCount[];
}

export interface CheckInDateTimeCount {
	/** Local calendar date for new buckets. Missing legacy values are December. */
	dateKey?: string;
	date: number;
	hour: number;
	customerCount: number;
	childCount: number;
	pregisteredCount: number;
	modifiedCount: number;
}
