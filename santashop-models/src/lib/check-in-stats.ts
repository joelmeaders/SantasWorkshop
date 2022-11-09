export interface CheckInAggregatedStats {
	lastUpdated: Date;
	dateTimeCount: CheckInDateTimeCount[];
}

export interface CheckInDateTimeCount {
	date: number;
	hour: number;
	customerCount: number;
	childCount: number;
	pregisteredCount: number;
	modifiedCount: number;
}
