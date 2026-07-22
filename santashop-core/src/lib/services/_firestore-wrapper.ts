import {
	addDoc,
	collection,
	CollectionReference,
	deleteDoc,
	doc,
	DocumentData,
	DocumentReference,
	onSnapshot,
	query as createQuery,
	Query,
	QueryConstraint,
	QuerySnapshot,
	SetOptions,
	type DocumentSnapshot,
	setDoc,
	Timestamp,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { Injectable, NgZone, inject } from '@angular/core';
import { FIREBASE_FIRESTORE } from '../tokens';

// Solves an issue where dates are being converted to timestamps
// in the database, but not being converted back to dates when read.
export const timestampDateFix = (date: Date): Date => {
	const timestamp = date as unknown as Timestamp;
	return timestamp?.toDate() ?? date;
};

export type idField<T> = keyof T & keyof NonNullable<T>;

/**
 * The entire reason for this class is to make
 * the modular firebase methods unit testable.
 *
 * @export
 * @class FirestoreMethods
 */
@Injectable({
	providedIn: 'root',
})
export class FirestoreWrapper {
	private readonly firestore = inject(FIREBASE_FIRESTORE);
	private readonly zone = inject(NgZone);

	private readonly mapDocumentData = <T = DocumentData>(
		snapshot: DocumentSnapshot<T>,
		options?: {
			idField?: keyof T;
		},
	): T | undefined => {
		if (!snapshot.exists()) return undefined;

		const data = snapshot.data();
		if (!data) return undefined;

		if (!options?.idField) return data;

		return {
			...data,
			[options.idField]: snapshot.id,
		} as T;
	};

	private readonly mapCollectionData = <
		T = DocumentData,
		U extends string = never,
	>(
		snapshot: QuerySnapshot<T>,
		idField?: (U | keyof T) & keyof NonNullable<T>,
	): ((T & Record<U, string>) | NonNullable<T>)[] =>
		snapshot.docs.map((documentSnapshot) => {
			const data = documentSnapshot.data();

			if (!idField) {
				return data as T & Record<U, string>;
			}

			return {
				...data,
				[idField]: documentSnapshot.id,
			} as (T & Record<U, string>) | NonNullable<T>;
		});

	public readonly collection = <T = DocumentData>(
		path: string,
	): CollectionReference<T> =>
		collection(this.firestore, path) as CollectionReference<T>;

	public readonly collectionQuery = <
		T = DocumentData,
		U extends string = never,
	>(
		query: Query<T>,
		idField?: (U | keyof T) & keyof NonNullable<T>,
	): Observable<((T & Record<U, string>) | NonNullable<T>)[]> =>
		new Observable<((T & Record<U, string>) | NonNullable<T>)[]>(
			(subscriber) =>
				onSnapshot(
					query,
					(snapshot) =>
						this.zone.run(() =>
							subscriber.next(
								this.mapCollectionData(snapshot, idField),
							),
						),
					(error) =>
						this.zone.run(() => subscriber.error(error)),
				),
		);

	public readonly doc = <T = DocumentData>(
		reference: CollectionReference<T>,
		path?: string,
	): DocumentReference<T> => (path ? doc(reference, path) : doc(reference));

	public readonly docData = <T = DocumentData>(
		ref: DocumentReference<T>,
		options?: {
			idField?: keyof T;
		},
	): Observable<T | undefined> =>
		new Observable<T | undefined>((subscriber) =>
			onSnapshot(
				ref,
				(snapshot) =>
					this.zone.run(() =>
						subscriber.next(
							this.mapDocumentData(snapshot, options),
						),
					),
				(error) => this.zone.run(() => subscriber.error(error)),
			),
		);

	public readonly query = <T = DocumentData>(
		collectionReference: CollectionReference<T>,
		constraints?: QueryConstraint[],
	): Query<T> =>
		constraints
			? createQuery(collectionReference, ...constraints)
			: createQuery(collectionReference);

	public readonly addDoc = <T>(
		collectionReference: CollectionReference<T>,
		document: T,
	): Promise<DocumentReference<T>> => addDoc(collectionReference, document);

	public readonly setDoc = <T = DocumentData>(
		documentReference: DocumentReference<T>,
		document: T,
		options?: SetOptions,
	): Promise<void> =>
		options
			? setDoc(documentReference, document, options)
			: setDoc(documentReference, document);

	public readonly deleteDoc = <T = DocumentData>(
		documentReference: DocumentReference<T>,
	): Promise<void> => deleteDoc(documentReference);
}
