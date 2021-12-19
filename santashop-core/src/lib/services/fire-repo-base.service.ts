import { Injectable } from '@angular/core';
import { addDoc, doc, docData, DocumentReference, Firestore, query, setDoc } from '@angular/fire/firestore';
import { collection, DocumentData, QueryConstraint, QueryDocumentSnapshot, SnapshotOptions } from 'firebase/firestore';
import { collection as rxCollection } from 'rxfire/firestore';
import { from, map, mapTo, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FireRepoBase {
  constructor(private readonly firestore: Firestore) { }

  public randomId(): string {
    const colRef = collection(this.firestore, '_');
    const docRef = doc(colRef);
    return docRef.id;
  }

  public read<T>(
    collectionPath: string,
    documentId: string,
    idField?: Extract<keyof T, string>
  ): Observable<T> {
    const colRef = collection(this.firestore, collectionPath);
    const docRef = doc<T>(colRef as any, documentId)
    return docData(docRef, { idField });
  }

  public readMany<T>(
    collectionPath: string,
    queryConstraints?: QueryConstraint[],
    idField?: Extract<keyof T, string>
  ): Observable<T[]> {
    const colRef = collection(this.firestore, collectionPath);
    const qry = queryConstraints ? query(colRef, ...queryConstraints) : query(colRef);

    return rxCollection(qry).pipe(
      map(snapshots => {
        const datas: T[] = [];
        snapshots.forEach(snapshot => {
          const data = {
            ...snapshot.data()
          } as T;
          if (idField) {
            (<any>data)[idField] = snapshot.id;
          }
          datas.push(data);
        })
        return datas;
      })
    );
  }

  public genericConverter<T>() {
    return {
      toFirestore(post: T): DocumentData {
        return post;
      },
      fromFirestore(
        snapshot: QueryDocumentSnapshot,
        options: SnapshotOptions
      ): T {
        const data = snapshot.data(options)!;
        return {
          ...data
        } as T;
      }
    }
  }

  public add<T>(
    collectionPath: string,
    document: T
  ): Observable<DocumentReference<T>> {
    const colRef = collection(this.firestore, collectionPath);
    const action = addDoc(colRef, document).then(
      response => response.withConverter(this.genericConverter<T>())
    );
    return from(action);

  }

  public addById<T>(
    collectionPath: string,
    documentId: string,
    document: T
  ): Observable<DocumentReference<T>> {
    const colRef = collection(this.firestore, collectionPath);
    const docRef = doc<T>(colRef as any, documentId)
    const action = setDoc(docRef, document);
    return from(action).pipe(mapTo(docRef));
  }

  public update<T>(
    collectionPath: string,
    documentId: string,
    document: T,
    merge = false
  ): Observable<DocumentReference> {
    const colRef = collection(this.firestore, collectionPath);
    const docRef = doc<T>(colRef as any, documentId)
    const action = setDoc(docRef, document, { merge });
    return from(action).pipe(mapTo(docRef));
  }
}
