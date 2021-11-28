import { Injectable } from '@angular/core';
import { FireRepoLite } from '@core/*';
import { COLLECTION_SCHEMA, IDateTimeCount, IRegistrationStats, IZipCodeCount } from '@models/*';
import { from } from 'rxjs';
import { map, pluck, reduce, switchMap, take } from 'rxjs/operators';
import { ICheckInAggregatedStats } from 'santashop-models/src/lib/models/check-in-stats';
import { groupBy, sortBy } from 'underscore';
import { Timestamp } from '@firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class StatsService {

  private readonly statsCollection = this.httpService.collection(COLLECTION_SCHEMA.stats);

  private readonly $registrationStats = this.statsCollection
    .read<IRegistrationStats>('registration-2021').pipe(
      take(1)
    );

  public readonly $completedRegistrations = this.$registrationStats.pipe(
    take(1),
    map((stats: any) => stats.completedRegistrations as number)
  );

  public readonly $registeredChildrenCount = this.$registrationStats.pipe(
    take(1),
    map((stats) => stats.dateTimeCount.map(e => e.childCount)),
    map(counts => {
      let value = 0;
      counts.forEach(c => value += c);
      return value;
    })
  );

  public readonly $registrationDateTimeCounts = this.$registrationStats.pipe(
    take(1),
    map((stats) => stats.dateTimeCount),
    map(stats => {
      stats.forEach(stat => stat.dateTime = (<any>stat.dateTime as Timestamp).toDate());
      return stats;
    }),
    map((stats) => {
      const sorted: IDateTimeCount[] = sortBy(stats, 'dateTime')
      // const grouped = groupBy(sorted, 'dateTime');
      return sorted;
    }),
  );

  public readonly $zipCodeCounts = this.$registrationStats.pipe(
    take(1),
    map((stats: any) => stats.zipCodeCount as IZipCodeCount),
    map((stats: IZipCodeCount) => sortBy(stats, 'childCount').reverse() as IZipCodeCount[])
  );

  private readonly $checkInStats = this.statsCollection
    .read<ICheckInAggregatedStats>('checkin-2021').pipe(
      take(1),
      map(stats => {
        stats.lastUpdated = (<any>stats.lastUpdated as Timestamp).toDate();
        return stats;
      })
    );

  public readonly $checkInLastUpdated = this.$checkInStats.pipe(
    map((updated) => updated.lastUpdated.toLocaleString())
  );

  public readonly $checkInDateTimeCounts = this.$checkInStats.pipe(
    pluck('dateTimeCount'),
    // map(counts => chain(counts).sortBy('hour').reverse().groupBy('date').value()),
    map(counts => {
      const sorted = sortBy(counts, 'dateTime').reverse();
      const grouped = groupBy(sorted, 'dateTime');
      return grouped;
    })
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
