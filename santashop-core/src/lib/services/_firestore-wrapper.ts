import {
	collection,
	CollectionReference as _CollectionReference,
	DocumentReference as _DocumentReference,
	SetOptions as _SetOptions,
	DocumentData as _DocumentData,
	FirestoreDataConverter as _FirestoreDataConverter,
	QueryConstraint as _QueryConstraint,
	QueryDocumentSnapshot as _QueryDocumentSnapshot,
	SnapshotOptions as _SnapshotOptions,
	Timestamp as _Timestamp,
} from 'firebase/firestore';
import {
	addDoc,
	deleteDoc,
	doc,
	docData,
	Firestore,
	query,
	setDoc,
} from '@angular/fire/firestore';
import { collection as rxCollection } from 'rxfire/firestore';
import { Query } from 'rxfire/firestore/interfaces';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';

// Re-export types to ensure no references to these libraries exist outside of this file
export type CollectionReference<T> = _CollectionReference<T>;
export type DocumentReference<T> = _DocumentReference<T>;
export type SetOptions = _SetOptions;
export type DocumentData = _DocumentData;
export type FirestoreDataConverter<T> = _FirestoreDataConverter<T>;
export type QueryConstraint = _QueryConstraint;
export type QueryDocumentSnapshot = _QueryDocumentSnapshot;
export type SnapshotOptions = _SnapshotOptions;
export type Timestamp = _Timestamp;

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

	// firebase/firestore methods
	public readonly collection = <T = DocumentData>(
		path: string
	): CollectionReference<T> =>
		collection(this.firestore, path) as CollectionReference<T>;

	public readonly doc = <T = DocumentData>(
		reference: CollectionReference<T>,
		path?: string
	): DocumentReference<T> =>
		path ? doc<T>(reference, path) : doc(reference);

	// @angular/fire/firestore Methods
	public readonly docData = <T = DocumentData>(
		ref: DocumentReference<T>,
		options?: {
			idField?: string;
		}
	): Observable<T> => docData<T>(ref, options);

	public readonly query = <T = DocumentData>(
		collectionReference: CollectionReference<T>,
		constraints?: QueryConstraint[]
	): Query<T> =>
		constraints
			? query<T>(collectionReference, ...constraints)
			: query<T>(collectionReference);

	public readonly addDoc = <T>(
		collectionReference: CollectionReference<T>,
		document: T
	): Promise<DocumentReference<T>> =>
		addDoc<T>(collectionReference, document);

	public readonly setDoc = <T = DocumentData>(
		documentReference: DocumentReference<T>,
		document: T,
		options?: SetOptions
	): Promise<void> =>
		options
			? setDoc<T>(documentReference, document, options)
			: setDoc<T>(documentReference, document);

	public readonly deleteDoc = <T = DocumentData>(
		documentReference: DocumentReference<T>
	): Promise<void> => deleteDoc(documentReference);

	// rxfire/firestore Methods
	public readonly rxCollection = <T = DocumentData>(
		qry: Query<T>
	): Observable<_QueryDocumentSnapshot<T>[]> => rxCollection(qry);
}
