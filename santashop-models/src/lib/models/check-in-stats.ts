export interface ICheckInAggregatedStats {
	lastUpdated: Date;
	dateTimeCount: ICheckInDateTimeCount[];
}

export interface ICheckInDateTimeCount {
	date: number;
	hour: number;
	customerCount: number;
	childCount: number;
	pregisteredCount: number;
	modifiedCount: number;
}
