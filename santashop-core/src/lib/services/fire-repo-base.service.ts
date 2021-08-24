import { Injectable } from '@angular/core';
import {
  AngularFirestore,
  DocumentReference,
  QueryFn,
} from '@angular/fire/firestore';
import { from, Observable } from 'rxjs';
import { map, mapTo } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class FireRepoBase {
  constructor(private readonly firestore: AngularFirestore) { }

  public read<T>(
    collectionPath: string,
    documentId: string,
    idField?: Extract<keyof T, string>
  ): Observable<T> {
    return this.firestore
      .collection(collectionPath)
      .doc<T>(documentId)
      .valueChanges({ idField })
      .pipe(
        map(response => response as T),
      );
  }

  public readMany<T>(
    collectionPath: string,
    query?: QueryFn,
    idField?: Extract<keyof T, string>
  ): Observable<T[]> {
    return this.firestore
      .collection<T>(collectionPath, query)
      .valueChanges({ idField });
  }

  public add<T>(
    collectionPath: string,
    document: T
  ): Observable<DocumentReference<T>> {
    const action = this.firestore.collection<T>(collectionPath).add(document);
    return from(action);
  }

  public addById<T>(
    collectionPath: string,
    documentId: string,
    document: T
  ): Observable<DocumentReference<T>> {
    const afsDocument = this.firestore
      .collection(collectionPath)
      .doc<T>(documentId);
    const action = afsDocument.set(document);
    return from(action).pipe(mapTo(afsDocument.ref));
  }

  public update<T>(
    collectionPath: string,
    documentId: string,
    document: T,
    merge = false
  ): Observable<DocumentReference> {
    const afsDocument = this.firestore
      .collection(collectionPath)
      .doc<T>(documentId);
    const action = afsDocument.set(document, { merge });
    return from(action).pipe(mapTo(afsDocument.ref));
  }
}
