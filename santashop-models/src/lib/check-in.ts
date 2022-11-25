export interface CheckIn {
	customerId?: string;
	registrationCode?: string;
	checkInDateTime?: Date;
	inStats: boolean;
	stats?: CheckInStats;
}

export interface CheckInStats {
	preregistered: boolean;
	children: number;
	ageGroup02: number;
	ageGroup35: number;
	ageGroup68: number;
	ageGroup911: number;
	toyTypeInfant: number;
	toyTypeBoy: number;
	toyTypeGirl: number;
	zipCode: string;
	modifiedAtCheckIn: boolean;
}

export interface CheckInAgeStats {
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
