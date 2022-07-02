import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FireRepoBase } from './fire-repo-base.service';
import { DocumentReference, QueryConstraint } from './_firestore-wrapper';

@Injectable({
	providedIn: 'root',
})
export class FireRepoLite {
	constructor(private readonly fireRepoBase: FireRepoBase) {}

	/**
	 * Generates a random id
	 *
	 * @return
	 * @memberof FireRepoLite
	 */
	public randomId(): string {
		return this.fireRepoBase.randomId();
	}

	/**
	 * This helper method wraps the FireRepoLite methods
	 * with a collection path and type, allowing easy
	 * reuse by consumers.
	 *
	 * @template T
	 * @param collectionPath Path to document
	 * @return
	 * @memberof FireRepoLite
	 */
	public collection<T>(collectionPath: string): IFireRepoCollection<T> {
		return {
			collectionPathName: collectionPath,

			read: (documentId: string, idField?: Extract<keyof T, string>) =>
				this.read<T>(collectionPath, documentId, idField),

			readMany: (
				queryConstraints?: QueryConstraint[],
				idField?: Extract<keyof T, string>
			) => this.readMany<T>(collectionPath, queryConstraints, idField),

			add: (document: T) => this.add<T>(collectionPath, document),

			addById: (documentId: string, document: T) =>
				this.addById<T>(collectionPath, documentId, document),

			update: (documentId: string, document: T, merge = false) =>
				this.update<T>(collectionPath, documentId, document, merge),

			delete: (documentId: string) =>
				this.delete(collectionPath, documentId),
		};
	}

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
	 * @param collectionPath Path to document
	 * @param documentId Id of document
	 * @param [idField] Optional
	 * @return
	 * @memberof FireRepoLite
	 */
	public read<T>(
		collectionPath: string,
		documentId: string,
		idField?: Extract<keyof T, string>
	): Observable<T> {
		return this.fireRepoBase.read<T>(collectionPath, documentId, idField);
	}

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
	 * @param collectionPath Path to document
	 * @param [queryConstraints] Optional
	 * @param [idField] Optional
	 * @return
	 * @memberof FireRepoLite
	 */
	public readMany<T>(
		collectionPath: string,
		queryConstraints?: QueryConstraint[],
		idField?: Extract<keyof T, string>
	): Observable<T[]> {
		return this.fireRepoBase.readMany<T>(
			collectionPath,
			queryConstraints,
			idField
		);
	}

	/**
	 * Add a new document to the specified collection path
	 *
	 * @template T
	 * @param collectionPath Path to document
	 * @param document Document to store
	 * @return
	 * @memberof FireRepoLite
	 */
	public add<T>(
		collectionPath: string,
		document: T
	): Observable<DocumentReference<T>> {
		return this.fireRepoBase.add<T>(collectionPath, document);
	}

	/**
	 * Add a new document to the specified collection path
	 * with the specified id.
	 *
	 * @template T
	 * @param collectionPath Path to document
	 * @param documentId Id to use
	 * @param document
	 * @return
	 * @memberof FireRepoLite
	 */
	public addById<T>(
		collectionPath: string,
		documentId: string,
		document: T
	): Observable<DocumentReference<T>> {
		return this.fireRepoBase.addById<T>(
			collectionPath,
			documentId,
			document
		);
	}

	/**
	 * Update a specified document at the specified collection
	 * path and id.
	 *
	 * Setting merge to true will allow upserts if the document
	 * doesn't doesn't exist. It will also non-destructively
	 * update documents by only replacing specified fields.
	 *
	 * @template T
	 * @param collectionPath Path to document
	 * @param documentId Document id
	 * @param document
	 * @param [merge=false] True = Upsert / Merge data
	 * @return
	 * @memberof FireRepoLite
	 */
	public update<T>(
		collectionPath: string,
		documentId: string,
		document: T,
		merge = false
	): Observable<DocumentReference<T>> {
		return this.fireRepoBase.update(
			collectionPath,
			documentId,
			document,
			merge
		);
	}

	/**
	 * Deletes the specified document
	 *
	 * @param collectionPath Path to document
	 * @param documentId Document id
	 * @return
	 * @memberof FireRepoLite
	 */
	public delete(
		collectionPath: string,
		documentId: string
	): Observable<void> {
		return this.fireRepoBase.delete(collectionPath, documentId);
	}
}

export interface IFireRepoCollection<T> {
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
	read(documentId: string, idField?: Extract<keyof T, string>): Observable<T>;

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
		idField?: Extract<keyof T, string>
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
		merge: boolean
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
