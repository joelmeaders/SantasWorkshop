import 'firebase/firestore';
import { firestore } from 'firebase';
import { AngularFirestoreCollection, AngularFirestore, DocumentReference, CollectionReference } from '@angular/fire/firestore';
import { AngularFireFunctions } from '@angular/fire/functions';
import { collectionData, docData, collection } from 'rxfire/firestore';

import { Observable, Subject, of, BehaviorSubject } from 'rxjs';
import { mapTo, take, catchError, mergeMap, publishReplay, refCount, map, tap, takeUntil } from 'rxjs/operators';

import { IBaseEntity } from '@app/core/models/base/base-entity';
import { CounterService } from './counter.service';

export interface IBaseHttpService<T> {
  save(entity: T, mergeIfUpdate: boolean): Observable<T>;
  readOne(pathOrId: string): Observable<T>;
  readMany(query?: firestore.Query<firestore.DocumentData>): Observable<T[]>;
  readMeta(field?: string): Observable<Date>;
  delete(id: string): Observable<boolean>;
  generateId(): string;
  collectionRef: CollectionReference;
  getCollectionPath(): string;
}

export enum QueryDirection {
  Initial = 0,
  Backward = -1,
  Forward = 1
}

export abstract class BaseHttpService<T extends IBaseEntity> implements IBaseHttpService<T> {
  private readonly _$destroy = new Subject<void>();
  public readonly $destroy = this._$destroy.asObservable().pipe(publishReplay(1), refCount());

  private readonly afCollection: AngularFirestoreCollection<T>;
  public readonly collectionRef: CollectionReference;
  protected readonly counterService: CounterService;

  constructor(
    private readonly firestoreDb: AngularFirestore,
    private readonly fireFunctions: AngularFireFunctions,
    public readonly collectionPath: string,
    private readonly counterShards = 0
  ) {
    this.afCollection = firestoreDb.collection(collectionPath);
    this.collectionRef = this.afCollection.ref;

    if (counterShards) {
      this.counterService = new CounterService(this.firestoreDb, this.fireFunctions, this.collectionPath, counterShards);
    }
  }

  public save(entity: T, mergeIfUpdate = false): Observable<T> {
    let action: Promise<void | DocumentReference>;

    this.cleanEntity(entity);
    const plainObject = this.entityToObject(entity);

    if (!plainObject.id) {
      plainObject.id = this.generateId();
      action = this.addEntity(plainObject);
    } else {
      action = this.updateEntity(plainObject, mergeIfUpdate);
    }

    return of(action).pipe(
      take(1),
      mergeMap(() => {
        if (this.counterShards > 0) return this.counterService.updateCounter(1);
        return of();
      }),
      mapTo(entity),
    );
  }

  private async addEntity(entity: T): Promise<DocumentReference> {
    return this.afCollection.add(entity);
  }

  private async updateEntity(entity: T, mergeIfUpdate = false): Promise<void> {
    return this.afCollection.doc<T>(entity.id).set(entity, { merge: mergeIfUpdate });
  }

  public readOne(pathOrId: string): Observable<T> {
    const documentReference = this.afCollection.doc(pathOrId).ref;
    return docData<T>(documentReference, 'id');
  }

  public readMany(query?: firestore.Query): Observable<T[]> {
    if (!query) {
      query = this.afCollection.ref.limit(50);
    }
    return collectionData<T>(query, 'id');
  }

  public readMeta(field = 'collectionLastUpdated'): Observable<Date> {
    const documentReference = this.firestoreDb.doc(`collection-meta/${this.collectionPath}`).ref;

    return docData(documentReference).pipe(
      take(1),
      map(response => {
        if (!response) {
          return undefined;
        }

        if (field === 'collectionLastUpdated') {
          return (response[field] as firestore.Timestamp).toDate();
          // return new Date(response[field]);
        }
      })
    );
  }

  private readonly _$queryLastDoc = new BehaviorSubject<firestore.DocumentSnapshot>(undefined);
  private readonly _$queryFirstDoc = new BehaviorSubject<firestore.DocumentSnapshot>(undefined);
  private readonly _$queryPageIndex = new BehaviorSubject<number>(0);

  public readonly $queryCurrentPage = this._$queryPageIndex.asObservable().pipe(
    takeUntil(this.$destroy),
    map(index => index + 1),
    publishReplay(1),
    refCount()
  );

  public readonly $queryAtFirstPage = this._$queryPageIndex.asObservable().pipe(
    takeUntil(this.$destroy),
    map(index => index === 0),
    publishReplay(1),
    refCount()
  );

  public readonly $queryAtLastPage = this._$queryLastDoc.asObservable().pipe(
    takeUntil(this.$destroy),
    map(page => !page),
    publishReplay(1),
    refCount()
  );

  public query(query: firestore.Query, action: QueryDirection, pageSize = 10): Observable<T[]> {
    let fsQuery: firestore.Query;

    if (action === QueryDirection.Initial) {
      fsQuery = query.limit(pageSize);
    }

    if (action === QueryDirection.Forward) {
      if (!this._$queryLastDoc.getValue()) {
        return of(undefined);
      } else {
        fsQuery = query.startAfter(this._$queryLastDoc.getValue()).limit(pageSize);
      }
    }

    if (action === QueryDirection.Backward) {
      if (this._$queryPageIndex.getValue() === 0) {
        return of(undefined);
      }
      fsQuery = query.endBefore(this._$queryFirstDoc.getValue()).limitToLast(pageSize);
    }

    return collection(fsQuery).pipe(
      take(1),
      tap(docs => {
        if (docs && docs.length) {
          this._$queryFirstDoc.next(docs[0] || this._$queryFirstDoc.getValue());
          this._$queryPageIndex.next((action += this._$queryPageIndex.getValue()));
        }
        this._$queryLastDoc.next(docs[pageSize - 1]);
      }),
      map(docs => docs.map(d => d.data() as T))
    );
  }

  public delete(id: string): Observable<boolean> {
    return of(this.afCollection.doc<T>(id).delete()).pipe(
      take(1),
      mergeMap(() => {
        if (this.counterShards > 0) return this.counterService.updateCounter(-1);
        return of(false);
      }),
      catchError(() => of(false))
    );
  }

  public getCount(): Observable<number> {
    if (this.counterShards <= 0) {
      throw new Error(`${this.collectionPath}: No counter shards in this collection`);
    }

    return this.counterService.getCount();
  }

  public updateCount(byValue: number): Observable<boolean> {
    if (this.counterShards <= 0) {
      throw new Error(`${this.collectionPath}: No counter shards in this collection`);
    }
    return this.counterService.updateCounter(byValue);
  }

  public generateId = () => this.firestoreDb.createId();

  public getCollectionPath = () => this.collectionPath;

  private cleanEntity(entity: T) {
    Object.keys(entity).forEach(key => {
      if (entity[key] === undefined || entity[key] === null) {
        delete entity[key];
      }
      if (entity[key] && typeof entity[key] === 'object') {
        this.cleanEntity(entity[key]);
        try {
          if (!Object.keys(entity[key]).length) {
            delete entity[key];
          }
        } catch {
          // Do nothing
        }
      }
    });
  }

  private entityToObject(entity: T) {
    return JSON.parse(JSON.stringify(Object.assign({}, entity)));
  }
}
