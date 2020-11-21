import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { mergeMap, pluck, reduce, take } from 'rxjs/operators';
import { FireCRUDStateless } from 'santashop-core/src/public-api';
import { Counter } from '../models/counter.model';

@Injectable({
  providedIn: 'root'
})
export class StatsService {

  private readonly COUNTER_COLLECTION = 'counters';

  constructor(
    private readonly httpService: FireCRUDStateless
  ) { }

  private $getCount<Counter>(results: Counter[]): Observable<number> {
    return from(results).pipe(
      pluck('count'),
      reduce((acc: number, curr) => acc + curr)
    );
  }

  public customers(): Observable<number> {
    return this.baseQuery('customers').pipe(
      take(1),
      mergeMap(this.$getCount)
    );
  }

  public registrations(): Observable<number> {
    return this.baseQuery('registrations').pipe(
      take(1),
      mergeMap(this.$getCount)
    );
  }

  public children(): Observable<number> {
    return this.baseQuery('children').pipe(
      take(1),
      mergeMap(this.$getCount)
    );
  }

  private baseQuery(path: string): Observable<Counter[]> {
    return this.httpService.readMany<Counter>(`${this.COUNTER_COLLECTION}/${path}/shards`);
  }
}
