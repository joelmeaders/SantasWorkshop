import { Injectable } from '@angular/core';
import { AngularFirestore, DocumentReference, Query } from '@angular/fire/firestore';
import { from, Observable } from 'rxjs';
import { mapTo } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class FireCRUDStateless {

  constructor(
    private readonly firestoreDb: AngularFirestore
  ) { }

  public readOne<T>(collectionPath: string, documentId: string, idField?: Extract<keyof T, string>): Observable<T> {
    return this.firestoreDb.collection(collectionPath).doc<T>(documentId)
      .valueChanges({ idField });
  }

  public readMany<T>(collectionPath: string, query?: Query, idField?: Extract<keyof T, string>): Observable<T[]> {
    // const collectionReference = this.firestoreDb.collection<T>(collectionPath).ref;
    // query = query ?? collectionReference.limit(50);
    // return collectionData<T>(query, idProperty);
    return this.firestoreDb.collection<T>(collectionPath, ).valueChanges({ idField });
  }

  public save<T>(collectionPath: string, docId: string = undefined, document: T, mergeIfUpdate = false): Observable<DocumentReference> {
    return !!docId
      ? this.add<T>(collectionPath, document)
      : this.update<T>(collectionPath, document, docId, mergeIfUpdate);
  }

  public add<T>(collectionPath: string, document: T): Observable<DocumentReference> {
    const collection = this.firestoreDb.collection<T>(collectionPath);
    return from(collection.add(document));
  }

  public update<T>(collectionPath: string, document: T, documentId: string, mergeChanges = false): Observable<DocumentReference> {
    const collection = this.firestoreDb.collection<T>(collectionPath);
    const documentReference = collection.doc<T>(documentId);
    return from(documentReference.set(document, { merge: mergeChanges })).pipe(
      mapTo(documentReference.ref)
    );
  }

  public delete<T>(collectionPath: string, documentId: string): Observable<boolean> {
    const collection = this.firestoreDb.collection<T>(collectionPath);
    const documentReference = collection.doc<T>(documentId);

    const action = documentReference.delete()
      .then(() => true)
      .catch(() => false);

    return from(action);
  }

  public collectionRef<T>(collectionPath: string): Query {
    return this.firestoreDb.collection<T>(collectionPath).ref;
  }
}