import { Injectable, inject } from '@angular/core';
import { FireRepoLite } from '@santashop/core';
import {
	COLLECTION_SCHEMA,
	type CheckIn,
	type RegistrationScanAttempt,
	type RegistrationScanRiskSummary,
} from '@santashop/models';
import { limit, orderBy, QueryConstraint, where } from 'firebase/firestore';
import { map, Observable } from 'rxjs';

const dateFromValue = (value: unknown): Date =>
	value instanceof Date
		? value
		: (value as { toDate: () => Date }).toDate();

@Injectable({ providedIn: 'root' })
export class ScanRiskService {
	private readonly repo = inject(FireRepoLite);

	public summaries(
		programYear: number,
		pageSize: number,
	): Observable<RegistrationScanRiskSummary[]> {
		return this.repo
			.collection<RegistrationScanRiskSummary>(
				COLLECTION_SCHEMA.registrationScanRiskSummaries,
			)
			.readMany(
				[
					where('programYear', '==', programYear),
					orderBy('latestRiskOn', 'desc'),
					limit(pageSize),
				] as QueryConstraint[],
				'id',
			)
			.pipe(
				map((summaries) =>
					summaries.map((summary) => ({
						...summary,
						firstRiskOn: dateFromValue(summary.firstRiskOn),
						latestRiskOn: dateFromValue(summary.latestRiskOn),
						...(summary.originalCheckInOn
							? { originalCheckInOn: dateFromValue(summary.originalCheckInOn) }
							: {}),
					})),
				),
			);
	}

	public attempts(
		programYear: number,
		customerId: string,
	): Observable<RegistrationScanAttempt[]> {
		return this.repo
			.collection<RegistrationScanAttempt>(
				COLLECTION_SCHEMA.registrationScanAttempts,
			)
			.readMany(
				[
					where('customerId', '==', customerId),
					where('programYear', '==', programYear),
					orderBy('scannedOn', 'desc'),
					limit(100),
				] as QueryConstraint[],
				'id',
			)
			.pipe(
				map((attempts) =>
					attempts.map((attempt) => ({
						...attempt,
						scannedOn: dateFromValue(attempt.scannedOn),
						priorEventOn: dateFromValue(attempt.priorEventOn),
					})),
				),
			);
	}

	public checkIn(customerId: string): Observable<CheckIn | undefined> {
		return this.repo
			.collection<CheckIn>(COLLECTION_SCHEMA.checkins)
			.read(customerId)
			.pipe(
				map((checkIn) =>
					checkIn?.checkInDateTime
						? {
								...checkIn,
								checkInDateTime: dateFromValue(checkIn.checkInDateTime),
							}
						: checkIn,
				),
			);
	}
}
