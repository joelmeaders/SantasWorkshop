import { Injectable } from '@angular/core';
import { FireRepoLite, Only } from '@core/*';
import {
	COLLECTION_SCHEMA,
	AgeGroupBreakdown,
	CheckInDateTimeCount,
	DateTimeCount,
	GenderAgeStats,
	IGenderAgeStatsDisplay,
	RegistrationStats,
	ZipCodeCount,
	CheckInAggregatedStats,
} from '../../../../santashop-models/src/public-api';
import { from } from 'rxjs';
import { map, reduce, shareReplay, switchMap, take } from 'rxjs/operators';
import { groupBy, sortBy } from 'underscore';
import { Timestamp } from '@firebase/firestore';

@Injectable({
	providedIn: 'root',
})
export class StatsService {
	private readonly statsCollection = <T>() =>
		this.httpService.collection<T>(COLLECTION_SCHEMA.stats);

	private readonly registrationStats =
		this.statsCollection<RegistrationStats>();
	private readonly checkinStats =
		this.statsCollection<CheckInAggregatedStats>();

	private readonly $registrationStats = this.registrationStats
		.read('registration-2022')
		.pipe(take(1));

	public readonly $completedRegistrations = this.$registrationStats.pipe(
		take(1),
		map((stats: any) => stats.completedRegistrations as number)
	);

	public readonly $registeredChildrenCount = this.$registrationStats.pipe(
		take(1),
		map((stats) => stats.dateTimeCount.map((e) => e.childCount)),
		map((counts) => {
			let value = 0;
			counts.forEach((c) => (value += c));
			return value;
		})
	);

	public readonly $registrationDateTimeCounts = this.$registrationStats.pipe(
		take(1),
		map((stats) => stats.dateTimeCount),
		map((stats) => {
			stats.forEach(
				(stat) =>
					(stat.dateTime = (
						stat.dateTime as any as Timestamp
					).toDate())
			);
			return stats;
		}),
		map((stats) => {
			const sorted: DateTimeCount[] = sortBy(stats, 'dateTime');
			return sorted;
		})
	);

	public readonly $registrationGenderAgeByDateCounts =
		this.$registrationDateTimeCounts.pipe(
			take(1),
			map((stats) => this.parseDateTimeCountsForDisplay(stats)),
			map((stats) => {
				const sorted: IGenderAgeStatsDisplay[] = sortBy(stats, 'date');
				return sorted;
			})
		);

	public readonly $zipCodeCounts = this.$registrationStats.pipe(
		take(1),
		map((stats: any) => stats.zipCodeCount as ZipCodeCount),
		map(
			(stats: ZipCodeCount) =>
				sortBy(stats, 'childCount').reverse() as ZipCodeCount[]
		)
	);

	private readonly checkInStats$ = this.checkinStats
		.read('checkin-2022')
		.pipe(
			take(1),
			map((stats) => {
				stats.lastUpdated = (
					stats.lastUpdated as any as Timestamp
				).toDate();
				return stats;
			})
		);

	public readonly $checkInLastUpdated = this.checkInStats$.pipe(
		map((updated) => updated.lastUpdated.toLocaleString())
	);

	private readonly dateTimeCount$ = this.checkInStats$.pipe(
		map((value) => value.dateTimeCount),
		shareReplay(1)
	);

	private readonly mapCount$ = (prop: Only<CheckInDateTimeCount, number>) =>
		this.dateTimeCount$.pipe(
			switchMap((dateTimeCounts) =>
				from(dateTimeCounts.map((dtc) => dtc[prop]))
			),
			reduce((acc, val) => acc + val)
		);

	public readonly $checkInDateTimeCounts = this.dateTimeCount$.pipe(
		map((counts) => {
			const sorted = sortBy(counts, 'hour').reverse();
			return groupBy(sorted, 'date');
		})
	);

	public readonly checkInTotalCustomerCount$ =
		this.mapCount$('customerCount');
	public readonly checkInTotalChildCount$ = this.mapCount$('childCount');
	public readonly $checkInTotalPreregisteredCount =
		this.mapCount$('pregisteredCount');
	public readonly $checkInTotalModifiedCount =
		this.mapCount$('modifiedCount');

	constructor(private readonly httpService: FireRepoLite) {}

	private newParsedStat(dayOfMonth: number): IGenderAgeStatsDisplay {
		const parsedStat: IGenderAgeStatsDisplay = {
			date: new Date(`12/${dayOfMonth}/${new Date().getFullYear()}`),
			stats: {
				infants: {
					total: 0,
					age02: 0,
					age35: 0,
					age68: 0,
					age911: 0,
				} as AgeGroupBreakdown,
				girls: {
					total: 0,
					age02: 0,
					age35: 0,
					age68: 0,
					age911: 0,
				} as AgeGroupBreakdown,
				boys: {
					total: 0,
					age02: 0,
					age35: 0,
					age68: 0,
					age911: 0,
				} as AgeGroupBreakdown,
			} as GenderAgeStats,
		};

		return parsedStat;
	}

	private parseDateTimeCountsForDisplay(
		stats: DateTimeCount[]
	): IGenderAgeStatsDisplay[] {
		const parsedStats: IGenderAgeStatsDisplay[] = [];

		const getIndex = (date: Date) =>
			parsedStats.findIndex((e) => e.date.getDate() === date.getDate());

		stats.forEach((stat) => {
			const index = getIndex(stat.dateTime);

			if (index > -1) {
				parsedStats[index].stats.infants.age02 +=
					stat.stats.infants.age02;
				parsedStats[index].stats.infants.age35 +=
					stat.stats.infants.age35;
				parsedStats[index].stats.infants.age68 +=
					stat.stats.infants.age68;
				parsedStats[index].stats.infants.age911 +=
					stat.stats.infants.age911;
				parsedStats[index].stats.infants.total +=
					stat.stats.infants.total;

				parsedStats[index].stats.girls.age02 += stat.stats.girls.age02;
				parsedStats[index].stats.girls.age35 += stat.stats.girls.age35;
				parsedStats[index].stats.girls.age68 += stat.stats.girls.age68;
				parsedStats[index].stats.girls.age911 +=
					stat.stats.girls.age911;
				parsedStats[index].stats.girls.total += stat.stats.girls.total;

				parsedStats[index].stats.boys.age02 += stat.stats.boys.age02;
				parsedStats[index].stats.boys.age35 += stat.stats.boys.age35;
				parsedStats[index].stats.boys.age68 += stat.stats.boys.age68;
				parsedStats[index].stats.boys.age911 += stat.stats.boys.age911;
				parsedStats[index].stats.boys.total += stat.stats.boys.total;
			} else {
				const newParsedStat = this.newParsedStat(
					stat.dateTime.getDate()
				);

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
