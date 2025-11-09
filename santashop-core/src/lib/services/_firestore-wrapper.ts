import {
	addDoc,
	collection,
	collectionData,
	CollectionReference,
	deleteDoc,
	doc,
	docData,
	Firestore,
	query,
	setDoc,
	Query,
	Timestamp,
	DocumentData,
	DocumentReference,
	QueryConstraint,
	SetOptions,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Injectable, inject } from '@angular/core';

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
	private readonly firestore = inject(Firestore);

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
		collectionData(query, { idField });

	public readonly doc = <T = DocumentData>(
		reference: CollectionReference<T>,
		path?: string,
	): DocumentReference<T> => (path ? doc(reference, path) : doc(reference));

	public readonly docData = <T = DocumentData>(
		ref: DocumentReference<T>,
		options?: {
			idField?: keyof T;
		},
	): Observable<T | undefined> => docData(ref, options);

	public readonly query = <T = DocumentData>(
		collectionReference: CollectionReference<T>,
		constraints?: QueryConstraint[],
	): Query<T> =>
		constraints
			? query(collectionReference, ...constraints)
			: query(collectionReference);

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
