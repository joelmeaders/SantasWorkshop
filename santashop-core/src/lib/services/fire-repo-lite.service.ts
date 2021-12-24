import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FireRepoBase } from './fire-repo-base.service';
import { DocumentData, DocumentReference, QueryConstraint } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class FireRepoLite {

  constructor(
    private readonly fireRepoBase: FireRepoBase
  ) { }

  public randomId(): string {
    return this.fireRepoBase.randomId();
  }

  public collection<T>(collectionPath: string): IFireRepoCollection<T> {
    
    return {
      collectionPathName: collectionPath,

      read: (documentId: string, idField?: Extract<keyof T, string>) => 
        this.read<T>(collectionPath, documentId, idField),
      
      readMany: (queryConstraints?: QueryConstraint[], idField?: Extract<keyof T, string>) =>
        this.readMany<T>(collectionPath, queryConstraints, idField),

      add: (document: T) =>
        this.add<T>(collectionPath, document),

      addById: (documentId: string, document: T) =>
        this.addById<T>(collectionPath, documentId, document),

      update: (documentId: string, document: T, merge = false) =>
        this.update(collectionPath, documentId, document, merge)
    }
  }

  public read<T>(collectionPath: string, documentId: string, idField?: Extract<keyof T, string>): Observable<T> {
    return this.fireRepoBase.read<T>(collectionPath, documentId, idField);
  }

  public readMany<T>(collectionPath: string, queryConstraints?: QueryConstraint[], idField?: Extract<keyof T, string>): Observable<T[]> {
    return this.fireRepoBase.readMany<T>(collectionPath, queryConstraints, idField);
  }

  public add<T>(collectionPath: string, document: T): Observable<DocumentReference<T>> {
    return this.fireRepoBase.add<T>(collectionPath, document);
  }

  public addById<T>(collectionPath: string, documentId: string, document: T): Observable<DocumentReference<T>> {
    return this.fireRepoBase.addById<T>(collectionPath, documentId, document)
  }

  public update<T>(collectionPath: string, documentId: string, document: T, merge = false): Observable<DocumentReference<DocumentData>> {
    return this.fireRepoBase.update(collectionPath, documentId, document, merge);
  }
}

export interface IFireRepoCollection<T> {
  collectionPathName: string;
  read(documentId: string, idField?: Extract<keyof T, string>): Observable<T>;
  readMany(queryConstraints?: QueryConstraint[], idField?: Extract<keyof T, string>): Observable<T[]>;
  add(document: T): Observable<DocumentReference<T>>;
  addById(documentId: string, document: T ): Observable<DocumentReference<T>>;
  update(documentId: string, document: T, merge: boolean): Observable<DocumentReference>;
}

export function fireRepoLiteTestProvider() {
  const spy = jasmine.createSpy('fs');
  return [
    { provide: FireRepoLite },
    { provide: FireRepoBase, useValue: spy }
  ]
}