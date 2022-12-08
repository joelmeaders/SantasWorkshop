import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';
import { ChartConfiguration, ChartData } from 'chart.js';
import { map, shareReplay } from 'rxjs';
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

		const getDayIndex = (date: number): number => {
			console.log(date);
			switch (date) {
				case 9:
					return 0;
				case 10:
					return 1;
				case 12:
					return 2;
				case 13:
					return 3;

				default:
					throw new Error('invalid date');
			}
		};

		data.forEach((e) => {
			const dayIndex = getDayIndex(e.date);
			arr[dayIndex].datasets[0].data.push(e.customerCount);
		});

		return arr;
	}
}
