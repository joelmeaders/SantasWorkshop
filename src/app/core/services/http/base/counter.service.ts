import { AngularFirestore, AngularFirestoreDocument } from '@angular/fire/firestore';
import { AngularFireFunctions } from '@angular/fire/functions';

import { take, takeUntil, publishReplay, refCount, map } from 'rxjs/operators';
import { Observable, Subject } from 'rxjs';


export interface Counter {
  count: number;
}

export class CounterService {
  private readonly $destroy = new Subject<void>();

  protected counterReference: AngularFirestoreDocument;

  constructor(
    private readonly db: AngularFirestore,
    private readonly functions: AngularFireFunctions,
    protected readonly collectionPath: string,
    protected readonly shardCount: number
  ) {
    this.initCounter();
  }

  public async initCounter() {
    if (this.shardCount <= 0) {
      return;
    }

    this.counterReference = this.db.collection('counters').doc(this.collectionPath);
  }

  public updateCounter(byValue: number): Observable<boolean> {
    const cloudFunction = this.functions.httpsCallable('modCounter');
    // return cloudFunction({ shardCount: this.shardCount, collection: this.collectionPath, adjustBy: byValue }).pipe(
    //   take(1),
    //   mapTo(true),
    //   catchError(error => {
    //     console.log(error.code, error.message, error.details);
    //     return throwError(error);
    //   })
    // );

    return cloudFunction({ shardCount: this.shardCount, collection: this.collectionPath, adjustBy: byValue }).pipe(
      take(1)
    );
  }

  public getCount(): Observable<number> {
    return this.counterReference.collection('shards').snapshotChanges()
      .pipe(
        takeUntil(this.$destroy),
        map(snapshot => {
          let totalCount = 0;
          snapshot.forEach(doc => {
            totalCount += doc.payload.doc.data().count;
          });
          return totalCount;
        }),
        publishReplay(1),
        refCount()
      );
  }
}
