import { AngularFirestoreCollection, AngularFirestore, DocumentReference, CollectionReference, Query } from '@angular/fire/firestore';
import { collectionData, docData, collection } from 'rxfire/firestore';
import { Observable, Subject, of, BehaviorSubject } from 'rxjs';
import { mapTo, take, catchError, publishReplay, refCount, map, tap, takeUntil } from 'rxjs/operators';
import { IBaseEntity } from '@app/core/models/base/base-entity';

export enum QueryDirection {
  Initial = 0,
  Backward = -1,
  Forward = 1
}

export abstract class BaseHttpService<T extends IBaseEntity> {

  constructor(
    private readonly firestoreDb: AngularFirestore,
    public readonly collectionPath: string,
  ) {
    this.afCollection = firestoreDb.collection(collectionPath);
    this.collectionRef = this.afCollection.ref;
  }

  private readonly _$destroy = new Subject<void>();
  public readonly $destroy = this._$destroy.asObservable().pipe(publishReplay(1), refCount());

  private readonly afCollection: AngularFirestoreCollection<T>;
  public readonly collectionRef: CollectionReference;

  private readonly _$queryLastDoc = new BehaviorSubject<firebase.default.firestore.DocumentSnapshot>(undefined);
  private readonly _$queryFirstDoc = new BehaviorSubject<firebase.default.firestore.DocumentSnapshot>(undefined);
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
      mapTo(entity)
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

  public readMany(query?: Query): Observable<T[]> {
    if (!query) {
      query = this.afCollection.ref.limit(50);
    }
    return collectionData<T>(query, 'id');
  }

  public query(query: Query, action: QueryDirection, pageSize = 10): Observable<T[]> {
    let fsQuery: Query;

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
      mapTo(true),
      catchError(() => of(false))
    );
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
