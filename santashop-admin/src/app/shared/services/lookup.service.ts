import { Injectable } from '@angular/core';
import { FireRepoLite, QueryConstraint } from '@core/*';
import {
	COLLECTION_SCHEMA,
	CheckIn,
	Registration,
	RegistrationSearchIndex,
} from '@models/*';
import { limit, orderBy, where } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class LookupService {
	private readonly collections = {
		searchIndex: this.repoService.collection<RegistrationSearchIndex>(
			COLLECTION_SCHEMA.registrationSearchIndex
		),
		registrations: this.repoService.collection<Registration>(
			COLLECTION_SCHEMA.registrations
		),
		checkins: this.repoService.collection<CheckIn>(
			COLLECTION_SCHEMA.checkins
		),
	};

	public readonly searchIndexByName$ = (
		firstName: string,
		lastName: string
	): Observable<RegistrationSearchIndex[]> =>
		this.queryIndexByName(firstName, lastName).pipe(
			map((results) => results ?? [])
		);

	public readonly searchIndexByQrCode$ = (
		qrCode: string
	): Observable<RegistrationSearchIndex[]> =>
		this.queryIndexByQrCode(qrCode).pipe(map((results) => results ?? []));

	public readonly getRegistrationByQrCode$ = (
		qrcode: string
	): Observable<Registration | undefined> =>
		this.queryRegistrationsByQrCode(qrcode).pipe(
			map((results) => {
				if (!results?.length)
					throw new Error(
						`Unable to find registration for code ${qrcode}`
					);

				return results.pop();
			})
		);

	public readonly getRegistrationByUid$ = (
		uid: string
	): Observable<Registration | undefined> =>
		this.collections.registrations
			.read(uid)
			.pipe(map((results) => results ?? undefined));

	// TODO: Separate by program year?
	public readonly getCheckinByUid$ = (
		uid: string
	): Observable<CheckIn | undefined> =>
		this.collections.checkins
			.read(uid)
			.pipe(map((results) => results ?? undefined));

	constructor(private readonly repoService: FireRepoLite) {}

	private queryIndexByName(
		firstName: string,
		lastName: string
	): Observable<RegistrationSearchIndex[]> {
		const queryConstraints: QueryConstraint[] = [
			where('firstName', '==', firstName),
			where('lastName', '>=', lastName),
			where('lastName', '<=', lastName + '\uf8ff'),
			limit(50),
		];

		return this.collections.searchIndex.readMany(queryConstraints);
	}

	private queryIndexByQrCode(
		qrCode: string
	): Observable<RegistrationSearchIndex[]> {
		const queryConstraints: QueryConstraint[] = [
			where('code', '==', qrCode),
			orderBy('lastName', 'asc'),
			orderBy('firstName', 'asc'),
			limit(1),
		];

		return this.collections.searchIndex.readMany(queryConstraints);
	}

	private queryRegistrationsByQrCode(
		qrCode: string
	): Observable<Registration[]> {
		const queryConstraints: QueryConstraint[] = [
			where('qrcode', '==', qrCode),
			orderBy('lastName', 'asc'),
			orderBy('firstName', 'asc'),
		];

		return this.collections.registrations.readMany(queryConstraints);
	}
}
