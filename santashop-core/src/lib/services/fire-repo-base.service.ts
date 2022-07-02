import { Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import {
	DocumentData,
	DocumentReference,
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
	constructor(private readonly firestoreWrapper: FirestoreWrapper) {}

	public randomId(): string {
		const colRef = this.firestoreWrapper.collection('_');
		const docRef = this.firestoreWrapper.doc(colRef);
		return docRef.id;
	}

	public read<T>(
		collectionPath: string,
		documentId: string,
		idField?: Extract<keyof T, string>
	): Observable<T> {
		const colRef = this.firestoreWrapper.collection(collectionPath);
		const docRef = this.firestoreWrapper.doc<T>(colRef as any, documentId);
		return this.firestoreWrapper.docData(docRef, { idField });
	}

	public readMany<T>(
		collectionPath: string,
		queryConstraints?: QueryConstraint[],
		idField?: Extract<keyof T, string>
	): Observable<T[]> {
		const colRef = this.firestoreWrapper.collection(collectionPath);
		const qry = queryConstraints
			? this.firestoreWrapper.query(colRef, queryConstraints)
			: this.firestoreWrapper.query(colRef);

		return this.firestoreWrapper.rxCollection(qry).pipe(
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
		const colRef = this.firestoreWrapper.collection(collectionPath);
		const action = this.firestoreWrapper
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
		const colRef = this.firestoreWrapper.collection(collectionPath);
		const docRef = this.firestoreWrapper.doc<T>(colRef as any, documentId);
		const action = this.firestoreWrapper.setDoc(docRef, document);
		return from(action).pipe(map(() => docRef));
	}

	public update<T>(
		collectionPath: string,
		documentId: string,
		document: T,
		merge = false
	): Observable<DocumentReference<T>> {
		const colRef = this.firestoreWrapper.collection(collectionPath);
		const docRef = this.firestoreWrapper.doc<T>(colRef as any, documentId);
		const action = this.firestoreWrapper.setDoc(docRef, document, {
			merge,
		});
		return from(action).pipe(map(() => docRef));
	}

	public delete(
		collectionPath: string,
		documentId: string
	): Observable<void> {
		const colRef = this.firestoreWrapper.collection(collectionPath);
		const docRef = this.firestoreWrapper.doc(colRef as any, documentId);
		const action = this.firestoreWrapper.deleteDoc(docRef);
		return from(action);
	}
}
