export interface ICheckIn {
	customerId?: string;
	registrationCode?: string;
	checkInDateTime?: Date;
	inStats: boolean;
	stats?: ICheckInStats;
}

export interface ICheckInStats {
	preregistered: boolean;
	children: number;
	ageGroup02: number;
	ageGroup35: number;
	ageGroup68: number;
	ageGroup911: number;
	toyTypeInfant: number;
	toyTypeBoy: number;
	toyTypeGirl: number;
	zipCode: number;
	modifiedAtCheckIn: boolean;
}

export interface ICheckInAgeStats {
	ageGroup02: number;
	ageGroup35: number;
	ageGroup68: number;
	ageGroup911: number;
	totalChildren: number;
	totalb: number;
	totalg: number;
	totali: number;
	lastRun: Date;
}
