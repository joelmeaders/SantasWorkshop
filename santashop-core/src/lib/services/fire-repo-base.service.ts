import { Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import {
	DocumentData,
	DocumentReference,
	Firestore,
	FirestoreDataConverter,
	FirestoreWrapper,
	QueryConstraint,
	QueryDocumentSnapshot,
	SnapshotOptions,
} from './_firestore-wrapper';

@Injectable({
	providedIn: 'root',
})
export class FireRepoBase {
	constructor(
		private readonly firestore: Firestore,
		private readonly firestoreMethods: FirestoreWrapper
	) {}

	public randomId(): string {
		const colRef = this.firestoreMethods.collection(this.firestore, '_');
		const docRef = this.firestoreMethods.doc(colRef);
		return docRef.id;
	}

	public read<T>(
		collectionPath: string,
		documentId: string,
		idField?: Extract<keyof T, string>
	): Observable<T> {
		const colRef = this.firestoreMethods.collection(
			this.firestore,
			collectionPath
		);
		const docRef = this.firestoreMethods.doc<T>(colRef as any, documentId);
		return this.firestoreMethods.docData(docRef, { idField });
	}

	public readMany<T>(
		collectionPath: string,
		queryConstraints?: QueryConstraint[],
		idField?: Extract<keyof T, string>
	): Observable<T[]> {
		const colRef = this.firestoreMethods.collection(
			this.firestore,
			collectionPath
		);
		const qry = queryConstraints
			? this.firestoreMethods.query(colRef, queryConstraints)
			: this.firestoreMethods.query(colRef);

		return this.firestoreMethods.rxCollection(qry).pipe(
			map((snapshots) => {
				const datas: T[] = [];
				snapshots.forEach((snapshot) => {
					const data = {
						...snapshot.data(),
					} as T;
					if (idField) {
						(data as any)[idField] = snapshot.id;
					}
					datas.push(data);
				});
				return datas;
			})
		);
	}

	private genericConverter<T>(): FirestoreDataConverter<T> {
		return {
			toFirestore(post: T): DocumentData {
				return post;
			},
			fromFirestore(
				snapshot: QueryDocumentSnapshot,
				options: SnapshotOptions
			): T {
				return { ...snapshot.data(options) } as T;
			},
		};
	}

	public add<T>(
		collectionPath: string,
		document: T
	): Observable<DocumentReference<T>> {
		const colRef = this.firestoreMethods.collection(
			this.firestore,
			collectionPath
		);
		const action = this.firestoreMethods
			.addDoc(colRef, document)
			.then((response) =>
				response.withConverter(this.genericConverter<T>())
			);
		return from(action);
	}

	public addById<T>(
		collectionPath: string,
		documentId: string,
		document: T
	): Observable<DocumentReference<T>> {
		const colRef = this.firestoreMethods.collection(
			this.firestore,
			collectionPath
		);
		const docRef = this.firestoreMethods.doc<T>(colRef as any, documentId);
		const action = this.firestoreMethods.setDoc(docRef, document);
		return from(action).pipe(map(() => docRef));
	}

	public update<T>(
		collectionPath: string,
		documentId: string,
		document: T,
		merge = false
	): Observable<DocumentReference<T>> {
		const colRef = this.firestoreMethods.collection(
			this.firestore,
			collectionPath
		);
		const docRef = this.firestoreMethods.doc<T>(colRef as any, documentId);
		const action = this.firestoreMethods.setDoc(docRef, document, {
			merge,
		});
		return from(action).pipe(map(() => docRef));
	}

	public delete(
		collectionPath: string,
		documentId: string
	): Observable<void> {
		const colRef = this.firestoreMethods.collection(
			this.firestore,
			collectionPath
		);
		const docRef = this.firestoreMethods.doc(colRef as any, documentId);
		const action = this.firestoreMethods.deleteDoc(docRef);
		return from(action);
	}
}
