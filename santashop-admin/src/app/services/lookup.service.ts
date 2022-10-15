import { Injectable } from '@angular/core';
import {
	CollectionReference,
	DocumentData,
} from '@angular/fire/compat/firestore';
import { FireRepoLite } from '@core/*';
import {
	COLLECTION_SCHEMA,
	CheckIn,
	Registration,
	RegistrationSearchIndex,
} from '@models/*';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
	providedIn: 'root',
})
export class LookupService {
	private readonly collections = {
		searchIndex: this.repoService.collection<RegistrationSearchIndex>(
			COLLECTION_SCHEMA.registrationSearchIndex
		),
		registrations: this.repoService.collection<Registration>(
			COLLECTION_SCHEMA.registrations
		),
		checkins: this.repoService.collection<CheckIn>(COLLECTION_SCHEMA.checkins),
	};

	public readonly searchIndexByName$ = (
		firstName: string,
		lastName: string
	): Observable<RegistrationSearchIndex[]> =>
		this.collections.searchIndex
			.readMany((q) =>
				this.queryIndexByName(q, firstName, lastName)
			)
			.pipe(map((results) => results ?? []));

	public readonly searchIndexByQrCode$ = (
		qrCode: string
	): Observable<RegistrationSearchIndex[]> =>
		this.collections.searchIndex
			.readMany((q) =>
				this.queryIndexByQrCode(q, qrCode)
			)
			.pipe(map((results) => results ?? []));

	public readonly getRegistrationByQrCode$ = (
		qrcode: string
	): Observable<Registration | undefined> =>
		this.collections.registrations
			.readMany((q) =>
				this.queryRegistrationsByQrCode(q, qrcode)
			)
			.pipe(map((results) => results[0] ?? undefined));

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
		q: CollectionReference<DocumentData>,
		firstName: string,
		lastName: string
	) {
		return q
			.where('firstName', '==', firstName)
			.where('lastName', '>=', lastName)
			.where('lastName', '<=', lastName + '\uf8ff')
			.limit(50);
	}

	private queryIndexByQrCode(
		q: CollectionReference<DocumentData>,
		qrCode: string
	) {
		return q
			.where('code', '==', qrCode)
			.orderBy('lastName', 'asc')
			.orderBy('firstName', 'asc')
			.limit(1);
	}

	private queryRegistrationsByQrCode(
		q: CollectionReference<DocumentData>,
		qrCode: string
	) {
		return q
			.where('qrcode', '==', qrCode)
			.orderBy('lastName', 'asc')
			.orderBy('firstName', 'asc');
	}
}
