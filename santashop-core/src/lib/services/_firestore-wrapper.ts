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

// Re-export types to ensure no references to these libraries exist outside of this file
export { Firestore };
export type CollectionReference<T> = _CollectionReference<T>;
export type DocumentReference<T> = _DocumentReference<T>;
export type SetOptions = _SetOptions;
export type DocumentData = _DocumentData;
export type FirestoreDataConverter<T> = _FirestoreDataConverter<T>;
export type QueryConstraint = _QueryConstraint;
export type QueryDocumentSnapshot = _QueryDocumentSnapshot;
export type SnapshotOptions = _SnapshotOptions;

/**
 * The entire reason for this class is to make
 * the modular firebase methods unit testable.
 *
 * @export
 * @class FirestoreMethods
 */
export class FirestoreWrapper {
	// firebase/firestore methods
	public readonly collection = (firestore: Firestore, path: string) =>
		collection(firestore, path);

	public readonly doc = <T>(
		reference: CollectionReference<T>,
		path?: string
	) => (path ? doc<T>(reference, path) : doc(reference));

	// @angular/fire/firestore Methods
	public readonly docData = <T>(
		ref: DocumentReference<T>,
		options?: {
			idField?: string;
		}
	) => docData(ref, options);

	public readonly query = (
		collectionReference: CollectionReference<DocumentData>,
		constraints?: QueryConstraint[]
	) =>
		constraints
			? query(collectionReference, ...constraints)
			: query(collectionReference);

	public readonly addDoc = <T>(
		collectionReference: CollectionReference<DocumentData>,
		document: T
	) => addDoc(collectionReference, document);

	public readonly setDoc = <T>(
		documentReference: DocumentReference<DocumentData>,
		document: T,
		options?: SetOptions
	) =>
		options
			? setDoc(documentReference, document, options)
			: setDoc(documentReference, document);

	public readonly deleteDoc = (
		documentReference: DocumentReference<unknown>
	) => deleteDoc(documentReference);

	// rxfire/firestore Methods
	public readonly rxCollection = (qry: Query<DocumentData>) =>
		rxCollection(qry);
}
