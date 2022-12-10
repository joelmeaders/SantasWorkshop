/* eslint-disable @typescript-eslint/naming-convention */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';
import { ChartConfiguration, ChartData } from 'chart.js';
import { map, shareReplay, switchMap } from 'rxjs';
import {
	IFireRepoCollection,
	FireRepoLite,
} from '../../../../../../../dist/santashop-core';
import {
	CheckInAggregatedStats,
	CheckInDateTimeCount,
	COLLECTION_SCHEMA,
} from '../../../../../../../dist/santashop-models';
import { filterNil } from '@core/*';

@Component({
	selector: 'admin-check-in',
	templateUrl: './check-in.page.html',
	styleUrls: ['./check-in.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckInPage {
	private readonly statsCollection = <T>(): IFireRepoCollection<T> =>
		this.httpService.collection<T>(COLLECTION_SCHEMA.stats);

	private readonly checkInRecord$ =
		this.statsCollection<CheckInAggregatedStats>()
			.read('checkin-2022')
			.pipe(shareReplay(1));

	private readonly dateTimeStats$ = this.checkInRecord$.pipe(
		filterNil(),
		map((data) => data.dateTimeCount)
	);

	public readonly checkinLastUpdated$ = this.checkInRecord$.pipe(
		map((updated) =>
			(updated.lastUpdated as any as Timestamp).toDate().toLocaleString()
		)
	);

	public readonly totalCustomers$ = this.dateTimeStats$.pipe(
		map((data) =>
			data.map((e) => e.customerCount).reduce((prev, curr) => prev + curr)
		)
	);

	public readonly totalChildren$ = this.dateTimeStats$.pipe(
		map((data) =>
			data.map((e) => e.childCount).reduce((prev, curr) => prev + curr)
		)
	);

	public readonly totalPreregistered$ = this.dateTimeStats$.pipe(
		map((data) =>
			data
				.map((e) => e.pregisteredCount)
				.reduce((prev, curr) => prev + curr)
		)
	);

	public readonly onSiteRegistrations$ = this.totalCustomers$.pipe(
		switchMap((total) =>
			this.totalPreregistered$.pipe(map((pre) => total - pre))
		)
	);

	public readonly totalModifiedRegistrations$ = this.dateTimeStats$.pipe(
		map((data) =>
			data.map((e) => e.modifiedCount).reduce((prev, curr) => prev + curr)
		)
	);

	// TODO: These should be redone to not need udated every year...
	public readonly checkInsByDayHour$ = this.dateTimeStats$.pipe(
		map((data) => this.mapDaysHoursToChart(data))
	);

	public barChartOptions: ChartConfiguration['options'] = {
		responsive: true,
		// We use these empty structures as placeholders for dynamic theming.
		scales: {
			x: {},
			y: {
				min: 0,
				max: 350,
			},
		},
		plugins: {
			legend: {
				display: false,
			},
			datalabels: {
				anchor: 'end',
				align: 'end',
			},
		},
	};

	public readonly colorSettings = {
		backgroundColor: [
			'rgba(255, 99, 132, 0.2)',
			'rgba(255, 159, 64, 0.2)',
			'rgba(255, 205, 86, 0.2)',
			'rgba(75, 192, 192, 0.2)',
			'rgba(54, 162, 235, 0.2)',
			'rgba(153, 102, 255, 0.2)',
			'rgba(201, 203, 207, 0.2)',
		],
		borderColor: [
			'rgb(255, 99, 132)',
			'rgb(255, 159, 64)',
			'rgb(255, 205, 86)',
			'rgb(75, 192, 192)',
			'rgb(54, 162, 235)',
			'rgb(153, 102, 255)',
			'rgb(201, 203, 207)',
		],
		borderWidth: 1,
	};

	constructor(private readonly httpService: FireRepoLite) {}

	private mapDaysHoursToChart(
		data: CheckInDateTimeCount[]
	): ChartData<'bar'>[] {
		const arr: {
			datasets: { data: number[]; label: string }[];
		}[] = [
			{
				datasets: [
					{ data: [], label: 'Dec 9th', ...this.colorSettings },
				],
			},
			{
				datasets: [
					{ data: [], label: 'Dec 10th', ...this.colorSettings },
				],
			},
			{
				datasets: [
					{ data: [], label: 'Dec 12th', ...this.colorSettings },
				],
			},
			{
				datasets: [
					{ data: [], label: 'Dec 13th', ...this.colorSettings },
				],
			},
		];

		const indexToDay = (index: number): number => {
			switch (index) {
				case 0:
					return 9;
				case 1:
					return 10;
				case 2:
					return 12;
				case 3:
					return 13;

				default:
					throw new Error('invalid date');
			}
		};

		const structure = [
			{ '9': 0, '10': 0, '11': 0, '12': 0, '13': 0, '14': 0, '15': 0 },
			{ '9': 0, '10': 0, '11': 0, '12': 0, '13': 0, '14': 0, '15': 0 },
			{ '9': 0, '10': 0, '11': 0, '12': 0, '13': 0, '14': 0, '15': 0 },
			{ '9': 0, '10': 0, '11': 0, '12': 0, '13': 0, '14': 0, '15': 0 },
		];

		const getCountForDayHour = (day: number, hour: number): number =>
			data.find((e) => e.date === day && e.hour === hour)
				?.customerCount ?? 0;

		structure.forEach((day, index) => {
			day[9] = getCountForDayHour(indexToDay(index), 9);
			day[10] = getCountForDayHour(indexToDay(index), 10);
			day[11] = getCountForDayHour(indexToDay(index), 11);
			day[12] = getCountForDayHour(indexToDay(index), 12);
			day[13] = getCountForDayHour(indexToDay(index), 13);
			day[14] = getCountForDayHour(indexToDay(index), 14);
			day[15] = getCountForDayHour(indexToDay(index), 15);
		});

		structure.forEach((day, index) => {
			arr[index].datasets[0].data.push(day[9]);
			arr[index].datasets[0].data.push(day[10]);
			arr[index].datasets[0].data.push(day[11]);
			arr[index].datasets[0].data.push(day[12]);
			arr[index].datasets[0].data.push(day[13]);
			arr[index].datasets[0].data.push(day[14]);
			arr[index].datasets[0].data.push(day[15]);
		});

		return arr;
	}
}
