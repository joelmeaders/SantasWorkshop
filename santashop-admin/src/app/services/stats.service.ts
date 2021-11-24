import { Injectable } from '@angular/core';
import { FireRepoLite } from '@core/*';
import { COLLECTION_SCHEMA, IDateTimeCount, IZipCodeCount } from '@models/*';
import { from } from 'rxjs';
import { map, pluck, reduce, switchMap, take } from 'rxjs/operators';
import { ICheckInAggregatedStats } from 'santashop-models/src/lib/models/check-in-stats';
import { chain, sortBy } from 'underscore';

@Injectable({
  providedIn: 'root'
})
export class StatsService {

  private readonly COUNTER_COLLECTION = 'counters';

  private readonly $registrationStats = this.httpService.collection(COLLECTION_SCHEMA.stats).read<MISSINGTYPE>('registration-2020').pipe(
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

  private readonly $checkInStats = this.httpService.collection(COLLECTION_SCHEMA.stats).read<ICheckInAggregatedStats>('checkin-2020').pipe(
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
    private readonly httpService: FireRepoLite
  ) { }
}
