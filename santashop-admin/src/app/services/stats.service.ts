import { Injectable } from '@angular/core';
import { FireRepoLite } from '@core/*';
import { COLLECTION_SCHEMA, IDateTimeCount, IRegistrationStats, IZipCodeCount } from '@models/*';
import { from } from 'rxjs';
import { map, pluck, reduce, switchMap, take } from 'rxjs/operators';
import { ICheckInAggregatedStats } from 'santashop-models/src/lib/models/check-in-stats';
import { groupBy, sortBy } from 'underscore';
import { Timestamp } from '@firebase/firestore';
import { IAgeGroupBreakdown, IGenderAgeStats, IGenderAgeStatsDisplay } from 'santashop-models/src';

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
      return sorted;
    }),
  );

  public readonly $registrationGenderAgeByDateCounts = this.$registrationDateTimeCounts.pipe(
    take(1),
    map(stats => this.parseDateTimeCountsForDisplay(stats)),
    map((stats) => {
      const sorted: IGenderAgeStatsDisplay[] = sortBy(stats, 'date')
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
    map(counts => {
      const sorted = sortBy(counts, 'hour').reverse();
      return groupBy(sorted, 'date');
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

  private newParsedStat(dayOfMonth: number): IGenderAgeStatsDisplay {
    const parsedStat: IGenderAgeStatsDisplay = {
      date: new Date(`12/${dayOfMonth}/${new Date().getFullYear()}`),
      stats: {
        infants: {
          total: 0,
          age02: 0,
          age35: 0,
          age68: 0,
          age911: 0
        } as IAgeGroupBreakdown,
        girls: {
          total: 0,
          age02: 0,
          age35: 0,
          age68: 0,
          age911: 0
        } as IAgeGroupBreakdown,
        boys: {
          total: 0,
          age02: 0,
          age35: 0,
          age68: 0,
          age911: 0
        } as IAgeGroupBreakdown
      } as IGenderAgeStats
    };

    return parsedStat;
  }

  private parseDateTimeCountsForDisplay(stats: IDateTimeCount[]): IGenderAgeStatsDisplay[] {
  
    const parsedStats: IGenderAgeStatsDisplay[] = [];

    const getIndex = (date: Date) => 
      parsedStats.findIndex(e => e.date.getDate() === date.getDate());

    stats.forEach(stat => {

      const index = getIndex(stat.dateTime);

      if (index > -1) {
        parsedStats[index].stats.infants.age02 += stat.stats.infants.age02;
        parsedStats[index].stats.infants.age35 += stat.stats.infants.age35;
        parsedStats[index].stats.infants.age68 += stat.stats.infants.age68;
        parsedStats[index].stats.infants.age911 += stat.stats.infants.age911;
        parsedStats[index].stats.infants.total += stat.stats.infants.total;

        parsedStats[index].stats.girls.age02 += stat.stats.girls.age02;
        parsedStats[index].stats.girls.age35 += stat.stats.girls.age35;
        parsedStats[index].stats.girls.age68 += stat.stats.girls.age68;
        parsedStats[index].stats.girls.age911 += stat.stats.girls.age911;
        parsedStats[index].stats.girls.total += stat.stats.girls.total;
        
        parsedStats[index].stats.boys.age02 += stat.stats.boys.age02;
        parsedStats[index].stats.boys.age35 += stat.stats.boys.age35;
        parsedStats[index].stats.boys.age68 += stat.stats.boys.age68;
        parsedStats[index].stats.boys.age911 += stat.stats.boys.age911;
        parsedStats[index].stats.boys.total += stat.stats.boys.total;
      }
      else {
        const newParsedStat = this.newParsedStat(stat.dateTime.getDate());

        newParsedStat.stats.infants.age02 += stat.stats.infants.age02;
        newParsedStat.stats.infants.age35 += stat.stats.infants.age35;
        newParsedStat.stats.infants.age68 += stat.stats.infants.age68;
        newParsedStat.stats.infants.age911 += stat.stats.infants.age911;
        newParsedStat.stats.infants.total += stat.stats.infants.total;

        newParsedStat.stats.girls.age02 += stat.stats.girls.age02;
        newParsedStat.stats.girls.age35 += stat.stats.girls.age35;
        newParsedStat.stats.girls.age68 += stat.stats.girls.age68;
        newParsedStat.stats.girls.age911 += stat.stats.girls.age911;
        newParsedStat.stats.girls.total += stat.stats.girls.total;
        
        newParsedStat.stats.boys.age02 += stat.stats.boys.age02;
        newParsedStat.stats.boys.age35 += stat.stats.boys.age35;
        newParsedStat.stats.boys.age68 += stat.stats.boys.age68;
        newParsedStat.stats.boys.age911 += stat.stats.boys.age911;
        newParsedStat.stats.boys.total += stat.stats.boys.total;

        parsedStats.push(newParsedStat);
      }
    });

    return parsedStats;

  }
}



