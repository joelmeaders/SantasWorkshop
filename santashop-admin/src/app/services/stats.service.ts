import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map, mergeMap, pluck, reduce, take, tap } from 'rxjs/operators';
import { FireCRUDStateless, IDateTimeCount, IZipCodeCount } from 'santashop-core/src/public-api';
import { chain, sortBy } from 'underscore';
import { Counter } from '../models/counter.model';

@Injectable({
  providedIn: 'root'
})
export class StatsService {

  private readonly COUNTER_COLLECTION = 'counters';

  private readonly $stats = this.httpService.readOne('stats', 'registration-2020').pipe(
    take(1)
  );

  public readonly $completedRegistrations = this.$stats.pipe(
    take(1),
    map((stats: any) => stats.completedRegistrations as number)
  );

  public readonly $dateTimeCounts = this.$stats.pipe(
    take(1),
    map((stats: any) => stats.dateTimeCount as IDateTimeCount),
    map((stats) => chain(stats).sortBy('time').groupBy('date').value()),
  );

  public readonly $zipCodeCounts = this.$stats.pipe(
    take(1),
    map((stats: any) => stats.zipCodeCount as IZipCodeCount),
    map((stats: IZipCodeCount) => sortBy(stats, 'childCount').reverse() as IZipCodeCount[])
  );

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
    return this.baseCountQuery('customers').pipe(
      take(1),
      mergeMap(this.$getCount)
    );
  }

  public registrations(): Observable<number> {
    return this.baseCountQuery('registrations').pipe(
      take(1),
      mergeMap(this.$getCount)
    );
  }

  public children(): Observable<number> {
    return this.baseCountQuery('children').pipe(
      take(1),
      mergeMap(this.$getCount)
    );
  }

  private baseCountQuery(path: string): Observable<Counter[]> {
    return this.httpService.readMany<Counter>(`${this.COUNTER_COLLECTION}/${path}/shards`);
  }
}
