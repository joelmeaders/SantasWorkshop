import { Injectable, inject } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { FirestoreWrapper } from './_firestore-wrapper';
import {
	CollectionReference,
	DocumentData,
	DocumentReference,
	FirestoreDataConverter,
	QueryConstraint,
	QueryDocumentSnapshot,
	SnapshotOptions,
} from '@angular/fire/firestore';

@Injectable({
	providedIn: 'root',
})
export class FireRepoLite {
	private readonly firestoreWrapper = inject(FirestoreWrapper);

	/**
	 * Generates a random id
	 *
	 * @return
	 * @memberof FireRepoLite
	 */
	public randomId(): string {
		const colRef = this.firestoreWrapper.collection('_');
		const docRef = this.firestoreWrapper.doc(colRef);
		return docRef.id;
	}

	private genericConverter<T>(): FirestoreDataConverter<T> {
		return {
			toFirestore: (post: T): DocumentData => {
				return post as DocumentData;
			},
			fromFirestore: (
				snapshot: QueryDocumentSnapshot,
				options: SnapshotOptions,
			): T => {
				return { ...snapshot.data(options) } as T;
			},
		};
	}

	/** @inheritdoc */
	public collection<T = DocumentData>(
		collectionPath: string,
	): IFireRepoCollection<T> {
		return {
			collectionPathName: collectionPath,

			/** @inheritdoc */
			read: (
				documentId: string,
				idField?: Extract<keyof T, string>,
			): Observable<T | undefined> => {
				const colRef = this.firestoreWrapper.collection(collectionPath);
				const docRef = this.firestoreWrapper.doc<T>(
					colRef as any,
					documentId,
				);
				return this.firestoreWrapper.docData(docRef, { idField });
			},

			/** @inheritdoc */
			readMany: (
				queryConstraints?: QueryConstraint[],
				idField?: Extract<keyof T, string>,
			): Observable<T[]> => {
				const colRef =
					this.firestoreWrapper.collection<T>(collectionPath);
				const qry = queryConstraints
					? this.firestoreWrapper.query(colRef, queryConstraints)
					: this.firestoreWrapper.query(colRef);

				return this.firestoreWrapper.collectionQuery(qry, idField);
			},

			/** @inheritdoc */
			add: (document: T): Observable<DocumentReference<T>> => {
				const colRef = this.firestoreWrapper.collection(collectionPath);
				const action = this.firestoreWrapper
					.addDoc<T>(colRef as CollectionReference<T>, document)
					.then((response) =>
						response.withConverter(this.genericConverter<T>()),
					);
				return from(action);
			},

			/** @inheritdoc */
			addById: (
				documentId: string,
				document: T,
			): Observable<DocumentReference<T>> => {
				const colRef = this.firestoreWrapper.collection(collectionPath);
				const docRef = this.firestoreWrapper.doc<T>(
					colRef as CollectionReference<T>,
					documentId,
				);
				const action = this.firestoreWrapper.setDoc<T>(
					docRef,
					document,
				);
				return from(action).pipe(map(() => docRef));
			},

			/** @inheritdoc */
			update: (
				documentId: string,
				document: T,
				merge = false,
			): Observable<DocumentReference<T>> => {
				const colRef = this.firestoreWrapper.collection(collectionPath);
				const docRef = this.firestoreWrapper.doc<T>(
					colRef as CollectionReference<T>,
					documentId,
				);
				const action = this.firestoreWrapper.setDoc<T>(
					docRef,
					document,
					{
						merge,
					},
				);
				return from(action).pipe(map(() => docRef));
			},

			/** @inheritdoc */
			delete: (documentId: string): Observable<void> => {
				const colRef = this.firestoreWrapper.collection(collectionPath);
				const docRef = this.firestoreWrapper.doc(colRef, documentId);
				const action = this.firestoreWrapper.deleteDoc(docRef);
				return from(action);
			},
		};
	}
}

/**
 * A collection of all repository actions
 *
 * @export
 * @interface IFireRepoCollection
 * @template T
 */
export interface IFireRepoCollection<T = DocumentData> {
	/**
	 * Collection path this collection was initialized with
	 *
	 * @type {string}
	 * @memberof IFireRepoCollection
	 */
	collectionPathName: string;

	/**
	 * Returns a document from the collection path by
	 * document id.
	 *
	 * If you specify an idField the document
	 * id will be populated into that field. The id field
	 * does not need to exist on the document in the data
	 * store.
	 *
	 * @template T
	 * @param {string} collectionPath Path to document
	 * @param {string} documentId Id of document
	 * @param {Extract<keyof T, string>} [idField] Optional
	 * @return {*}  {Observable<T>}
	 * @memberof FireRepoLite
	 */
	read(
		documentId: string,
		idField?: Extract<keyof T, string>,
	): Observable<T | undefined>;

	/**
	 * Read many documents from the collection path with
	 * optional query constraints.
	 *
	 * If you specify an idField the document
	 * id will be populated into that field. The id field
	 * does not need to exist on the document in the data
	 * store.
	 *
	 * @template T
	 * @param {QueryConstraint[]} [queryConstraints] Optional
	 * @param {Extract<keyof T, string>} [idField] Optional
	 * @return {*}  {Observable<T[]>}
	 * @memberof FireRepoLite
	 */
	readMany(
		queryConstraints?: QueryConstraint[],
		idField?: Extract<keyof T, string>,
	): Observable<T[]>;

	/**
	 * Add a new document to the specified collection path
	 *
	 * @template T
	 * @param {string} collectionPath Path to document
	 * @param {T} document Document to store
	 * @return {*}  {Observable<DocumentReference<T>>}
	 * @memberof FireRepoLite
	 */
	add(document: T): Observable<DocumentReference<T>>;

	/**
	 * Add a new document to the specified collection path
	 * with the specified id.
	 *
	 * @template T
	 * @param {string} documentId Id to use
	 * @param {T} document
	 * @return {*}  {Observable<DocumentReference<T>>}
	 * @memberof FireRepoLite
	 */
	addById(documentId: string, document: T): Observable<DocumentReference<T>>;

	/**
	 * Update a specified document at the specified collection
	 * path and id.
	 *
	 * Setting merge to true will allow upserts if the document
	 * doesn't doesn't exist. It will also non-destructively
	 * update documents by only replacing specified fields.
	 *
	 * @template T
	 * @param {string} documentId Document id
	 * @param {T} document
	 * @param {boolean} [merge=false] True = Upsert / Merge data
	 * @return {*}  {Observable<DocumentReference<DocumentData>>}
	 * @memberof FireRepoLite
	 */
	update(
		documentId: string,
		document: T,
		merge: boolean,
	): Observable<DocumentReference<T>>;

	/**
	 * Deletes the specified document
	 *
	 * @param {string} documentId Document id
	 * @return {*}  {Observable<void>}
	 * @memberof FireRepoLite
	 */
	delete(documentId: string): Observable<void>;
}
