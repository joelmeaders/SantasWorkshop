import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map, mergeMap, pluck, reduce, switchMap, take, tap } from 'rxjs/operators';
import { ICheckInAggregatedStats } from 'santashop-core/src/lib/models/check-in-stats';
import { FireCRUDStateless, IDateTimeCount, IZipCodeCount } from 'santashop-core/src';
import { chain, sortBy } from 'underscore';
import { Counter } from '../models/counter.model';

@Injectable({
  providedIn: 'root'
})
export class StatsService {

  private readonly COUNTER_COLLECTION = 'counters';

  private readonly $registrationStats = this.httpService.readOne('stats', 'registration-2020').pipe(
    take(1)
  );

  public readonly $completedRegistrations = this.$registrationStats.pipe(
    take(1),
    map((stats: any) => stats.completedRegistrations as number)
  );

  public readonly $registrationDateTimeCounts = this.$registrationStats.pipe(
    take(1),
    map((stats: any) => stats.dateTimeCount as IDateTimeCount),
    map((stats) => chain(stats).sortBy('time').groupBy('date').value()),
  );

  public readonly $zipCodeCounts = this.$registrationStats.pipe(
    take(1),
    map((stats: any) => stats.zipCodeCount as IZipCodeCount),
    map((stats: IZipCodeCount) => sortBy(stats, 'childCount').reverse() as IZipCodeCount[])
  );

  private readonly $checkInStats = this.httpService.readOne<ICheckInAggregatedStats>('stats', 'checkin-2020').pipe(
    take(1)
  );

  public readonly $checkInLastUpdated = this.$checkInStats.pipe(
    pluck('lastUpdated'),
    map((updated) => updated.toDate().toLocaleString())
  );

  public readonly $checkInDateTimeCounts = this.$checkInStats.pipe(
    pluck('dateTimeCount'),
    map(counts => chain(counts).sortBy('hour').reverse().groupBy('date').value()),
  );

  public readonly $checkInTotalCustomerCount = this.$checkInStats.pipe(
    pluck('dateTimeCount'),
    switchMap(dateTimeCounts => from(dateTimeCounts.map(dtc => dtc.customerCount))),
    reduce((acc, val) => acc + val)
  );

  public readonly $checkInTotalChildCount = this.$checkInStats.pipe(
    pluck('dateTimeCount'),
    switchMap(dateTimeCounts => from(dateTimeCounts.map(dtc => dtc.childCount))),
    reduce((acc, val) => acc + val)
  );

  public readonly $checkInTotalPreregisteredCount = this.$checkInStats.pipe(
    pluck('dateTimeCount'),
    switchMap(dateTimeCounts => from(dateTimeCounts.map(dtc => dtc.pregisteredCount))),
    reduce((acc, val) => acc + val)
  );

  public readonly $checkInTotalModifiedCount = this.$checkInStats.pipe(
    pluck('dateTimeCount'),
    switchMap(dateTimeCounts => from(dateTimeCounts.map(dtc => dtc.modifiedCount))),
    reduce((acc, val) => acc + val)
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
