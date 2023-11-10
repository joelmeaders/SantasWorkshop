import {
	addDoc,
	connectFirestoreEmulator as _connectFirestoreEmulator,
	collection,
	collectionData,
	CollectionReference as _CollectionReference,
	deleteDoc,
	doc,
	docData,
	DocumentData as _DocumentData,
	DocumentReference as _DocumentReference,
	FirestoreDataConverter as _FirestoreDataConverter,
	getFirestore as _getFirestore,
	provideFirestore as _provideFirestore,
	Firestore,
	query,
	QueryConstraint as _QueryConstraint,
	QueryDocumentSnapshot as _QueryDocumentSnapshot,
	where as _where,
	setDoc,
	SetOptions as _SetOptions,
	SnapshotOptions as _SnapshotOptions,
	Timestamp as _Timestamp,
	Query,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';

// Re-export types to ensure no references to these libraries exist outside of this file
export type CollectionReference<T> = _CollectionReference<T>;
export type DocumentReference<T> = _DocumentReference<T>;
export type SetOptions = _SetOptions;
export type DocumentData = _DocumentData;
export type FirestoreDataConverter<T> = _FirestoreDataConverter<T>;
export type QueryConstraint = _QueryConstraint;
export type QueryDocumentSnapshot<T = DocumentData> = _QueryDocumentSnapshot<T>;
export type SnapshotOptions = _SnapshotOptions;
export type Timestamp = _Timestamp;
export const TimestampFn = _Timestamp;
export const where = _where;
export const connectFirestoreEmulator = _connectFirestoreEmulator;
export const getFirestore = _getFirestore;
export const provideFirestore = _provideFirestore;

// Solves an issue where dates are being converted to timestamps
// in the database, but not being converted back to dates when read.
export const timestampDateFix = (date: Date): Date => {
	const timestamp = date as unknown as Timestamp;
	return timestamp?.toDate() ?? date;
};

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
	constructor(private readonly firestore: Firestore) {}

	public readonly collection = <T = DocumentData>(
		path: string,
	): CollectionReference<T> =>
		collection(this.firestore, path) as CollectionReference<T>;

	public readonly collectionQuery = <T = DocumentData>(
		query: Query<T>,
		idField?: Extract<keyof T, string>,
	) => collectionData(query, { idField });

	public readonly doc = <T = DocumentData>(
		reference: CollectionReference<T>,
		path?: string,
	): DocumentReference<T> =>
		path ? doc<T>(reference, path) : doc(reference);

	public readonly docData = <T = DocumentData>(
		ref: DocumentReference<T>,
		options?: {
			idField?: string;
		},
	): Observable<T> => docData<T>(ref, options);

	public readonly query = <T = DocumentData>(
		collectionReference: CollectionReference<T>,
		constraints?: QueryConstraint[],
	): Query<T> =>
		constraints
			? query<T>(collectionReference, ...constraints)
			: query<T>(collectionReference);

	public readonly addDoc = <T>(
		collectionReference: CollectionReference<T>,
		document: T,
	): Promise<DocumentReference<T>> =>
		addDoc<T>(collectionReference, document);

	public readonly setDoc = <T = DocumentData>(
		documentReference: DocumentReference<T>,
		document: T,
		options?: SetOptions,
	): Promise<void> =>
		options
			? setDoc<T>(documentReference, document, options)
			: setDoc<T>(documentReference, document);

	public readonly deleteDoc = <T = DocumentData>(
		documentReference: DocumentReference<T>,
	): Promise<void> => deleteDoc(documentReference);
}
