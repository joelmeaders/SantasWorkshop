import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DocumentReference, QueryFn } from '@angular/fire/compat/firestore';
import { FireRepoBase } from './fire-repo-base.service';

@Injectable({
  providedIn: 'root'
})
export class FireRepoLite {

  constructor(
    private readonly fireRepoBase: FireRepoBase
  ) { }

  public readonly collection = (collectionPath: string): IFireRepoCollection => ({

    collection: collectionPath,

    read: <T>(documentId: string, idField?: Extract<keyof T, string>) => 
      this.fireRepoBase.read<T>(collectionPath, documentId, idField),
    
    readMany: <T>(query?: QueryFn, idField?: Extract<keyof T, string>) =>
      this.fireRepoBase.readMany<T>(collectionPath, query, idField),

    add: <T>(document: T) =>
      this.fireRepoBase.add<T>(collectionPath, document),

    addById: <T>(documentId: string, document: T) =>
      this.fireRepoBase.addById<T>(collectionPath, documentId, document),

    update: <T>(documentId: string, document: T, merge = false) =>
      this.fireRepoBase.update(collectionPath, documentId, document, merge)
  });
}
export interface IFireRepoCollection {
  collection: string;
  read<T>(documentId: string, idField?: Extract<keyof T, string>): Observable<T>;
  readMany<T>(query?: QueryFn, idField?: Extract<keyof T, string>): Observable<T[]>;
  add<T>(document: T): Observable<DocumentReference<T>>;
  addById<T>(documentId: string, document: T ): Observable<DocumentReference<T>>;
  update<T>(documentId: string, document: T, merge: boolean): Observable<DocumentReference>;
}
