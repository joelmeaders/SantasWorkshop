import { Injectable } from '@angular/core';
import { AngularFirestore, DocumentReference, Query } from '@angular/fire/firestore';
import { collectionData, docData } from 'rxfire/firestore';
import { from, Observable } from 'rxjs';
import { mapTo } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class FireCRUDStateless {

  constructor(
    private readonly firestoreDb: AngularFirestore
  ) { }

  public readOne<T>(collectionPath: string, documentId: string, idProperty?: Extract<keyof T, string>): Observable<T> {
    const collection = this.firestoreDb.collection<T>(collectionPath);
    const documentReference = collection.doc(documentId).ref;
    return docData<T>(documentReference, idProperty);
  }

  public readMany<T>(collectionPath: string, query?: Query, idProperty?: Extract<keyof T, string>): Observable<T[]> {
    const collectionReference = this.firestoreDb.collection<T>(collectionPath).ref;
    query = query ?? collectionReference.limit(50);
    return collectionData<T>(query, idProperty);
  }

  public save<T>(collectionPath: string, document: T, idProperty?: Extract<keyof T, string>, mergeIfUpdate = false): Observable<DocumentReference> {
    const id: string = document[idProperty.toString()];

    return !!id
      ? this.add<T>(collectionPath, document)
      : this.update<T>(collectionPath, document, id, mergeIfUpdate);
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