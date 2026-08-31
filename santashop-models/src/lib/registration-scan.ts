import { CheckIn } from './check-in';
import { RegistrationCancellation } from './cancellation';
import { Registration } from './registration';

export type ScanDisposition =
	| 'eligible'
	| 'duplicate-accidental'
	| 'duplicate-risk'
	| 'cancelled'
	| 'incomplete'
	| 'not-found';

export type ScanInputMethod = 'camera' | 'manual';
export type ScanRiskOutcome = Extract<
	ScanDisposition,
	'duplicate-risk' | 'cancelled'
>;
export type BlockedScanDisposition = Exclude<
	ScanDisposition,
	'eligible' | 'incomplete' | 'not-found'
>;

export interface ResolveRegistrationScanRequest {
	code: string;
	inputMethod: ScanInputMethod;
}

export interface RegistrationScanAttempt {
	id?: string;
	customerId: string;
	scannerUid: string;
	scannedOn: Date;
	programYear: number;
	outcome: BlockedScanDisposition;
	priorEventOn: Date;
	elapsedSeconds: number;
	inputMethod: ScanInputMethod;
	codeFingerprint: string;
	codeSuffix: string;
}

export interface RegistrationScanRiskSummary {
	id?: string;
	customerId: string;
	programYear: number;
	firstName: string;
	lastName: string;
	emailAddress: string;
	accidentalAttemptCount: number;
	lateDuplicateAttemptCount: number;
	cancelledCodeAttemptCount: number;
	totalRiskAttemptCount: number;
	firstRiskOn: Date;
	latestRiskOn: Date;
	latestOutcome: ScanRiskOutcome;
	originalCheckInOn?: Date;
}

export type ResolveRegistrationScanResult =
	| {
			disposition: 'eligible';
			registration: Registration;
	  }
	| {
			disposition: 'incomplete';
			customerId: string;
	  }
	| {
			disposition: 'not-found';
	  }
	| {
			disposition: BlockedScanDisposition;
			registration: Registration;
			attempt: RegistrationScanAttempt;
			priorCheckIn?: CheckIn;
			cancellation?: RegistrationCancellation;
	  };

export interface CheckInRequest {
	registration: Partial<Registration>;
	inputMethod: ScanInputMethod;
}
