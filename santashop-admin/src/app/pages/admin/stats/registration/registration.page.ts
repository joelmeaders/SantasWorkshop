import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FireRepoLite, IFireRepoCollection, filterNil } from '@santashop/core';
import {
	COLLECTION_SCHEMA,
	RegistrationStats,
	ScheduleStats,
} from '@santashop/models';
import { combineLatest, map, Observable, shareReplay } from 'rxjs';
import { Timestamp } from '@firebase/firestore';

import { Chart, ChartConfiguration, ChartData } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(ChartDataLabels);

@Component({
	selector: 'admin-registration',
	templateUrl: './registration.page.html',
	styleUrls: ['./registration.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationPage {
	private readonly statsCollection = <T>(): IFireRepoCollection<T> =>
		this.httpService.collection<T>(COLLECTION_SCHEMA.stats);

	private readonly registrationStats$ =
		this.statsCollection<RegistrationStats>()
			.read('registration-2023')
			.pipe(filterNil(), shareReplay(1));

	public readonly registrationCount$ = this.registrationStats$.pipe(
		map((stats) => stats.completedRegistrations),
	);

	private readonly scheduleStats$ = this.statsCollection<ScheduleStats>()
		.read('schedule-2023')
		.pipe(filterNil(), shareReplay(1));

	private readonly dateTimeStats$ = this.scheduleStats$.pipe(
		map((allData) => allData.dateTimeCounts),
	);

	public readonly childCount$ = this.registrationStats$.pipe(
		map((stats) => stats.dateTimeCount.map((e) => e.childCount)),
		map((counts) => counts.reduce((a, b) => a + b, 0)),
	);

	public readonly childrenPerCustomer$ = combineLatest([
		this.registrationCount$,
		this.childCount$,
	]).pipe(map((data) => data[1] / data[0]));

	private readonly stats$ = this.registrationStats$.pipe(
		map((stats) => stats.dateTimeCount),
		map((dateTimes) => dateTimes.map((e) => e.stats)),
	);

	public readonly boyCount$ = this.stats$.pipe(
		map((stats) => stats.map((e) => e.boys)),
		map((boys) => boys.reduce((a, b) => a + b.total, 0)),
	);

	public readonly girlCount$ = this.stats$.pipe(
		map((stats) => stats.map((e) => e.girls)),
		map((girls) => girls.reduce((a, b) => a + b.total, 0)),
	);

	public readonly infantCount$ = this.stats$.pipe(
		map((stats) => stats.map((e) => e.infants)),
		map((infants) => infants.reduce((a, b) => a + b.total, 0)),
	);

	public readonly girlBoyInfantCounts$ = combineLatest([
		this.girlCount$,
		this.boyCount$,
		this.infantCount$,
	]);

	public readonly familiesBySlots$ = this.dateTimeStats$.pipe(
		map((dateTimes) =>
			dateTimes.map((e) => ({
				date: (e.dateTime as any as Timestamp).toDate(),
				count: e.count,
			})),
		),

		map((data) => data.sort((a, b) => Number(a.date) - Number(b.date))),
	);

	public readonly familiesBySlotsChartData$ = this.familiesBySlots$.pipe(
		map((data) => this.mapFamiliesByDateToChart2(data)),
	);

	private readonly zipCodeStats$ = this.registrationStats$.pipe(
		map((allData) => allData.zipCodeCount),
	);

	public readonly topFiveZipCodesCount$ = this.zipCodeStats$.pipe(
		map((data) => data.sort((a, b) => b.count - a.count)),
		map((data) => data.slice(0, 4)),
	);

	public readonly topTenZipCodesCountData$: Observable<
		ChartData<'pie', number[], string | string[]>
	> = this.topFiveZipCodesCount$.pipe(
		map((data) => {
			const formatted: ChartData<'pie', number[], string | string[]> = {
				labels: [],
				datasets: [
					{
						data: [],
						...this.colorSettings,
					},
				],
			};

			data.forEach((e) => {
				formatted!.labels!.push([
					e.zip.toString(),
					`${e.count.toString()} Families`,
				]);
				formatted.datasets[0].data.push(e.count);
			});

			return formatted;
		}),
	);

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

	public zipCodeOptions: ChartConfiguration['options'] = {
		responsive: true,
		plugins: {
			datalabels: {
				clamp: false,
				color: '#FFF',
				align: 'end',
				anchor: 'start',
				textAlign: 'start',
				textShadowColor: '#000',
				textShadowBlur: 5,
				textStrokeColor: '#000',
				textStrokeWidth: 2,
				font: {
					size: 20,
					weight: 'bold',
				},
				formatter: (_, ctx) => {
					if (ctx.chart.data.labels) {
						return ctx.chart.data.labels[ctx.dataIndex];
					}
					return '';
				},
			},
		},
	};

	public chartOptions: ChartConfiguration['options'] = {
		responsive: true,
		plugins: {
			datalabels: {
				clamp: false,
				color: '#FFF',
				align: 'end',
				anchor: 'start',
				textAlign: 'start',
				textShadowColor: '#000',
				textShadowBlur: 5,
				textStrokeColor: '#000',
				textStrokeWidth: 2,
				font: {
					size: 20,
					weight: 'bold',
				},
				formatter: (value, ctx) => {
					return `${value} ${ctx.chart?.data?.labels![
						ctx.dataIndex
					]}`;
				},
			},
		},
	};

	public barChartOptions: ChartConfiguration['options'] = {
		responsive: true,
		// We use these empty structures as placeholders for dynamic theming.
		scales: {
			x: {},
			y: {
				min: 0,
			},
		},
		plugins: {
			legend: {
				display: false,
			},
			datalabels: {
				anchor: 'end',
				align: 'bottom',
				clamp: false,
				color: '#FFF',
				textAlign: 'start',
				textShadowColor: '#000',
				textShadowBlur: 5,
				textStrokeColor: '#000',
				textStrokeWidth: 2,
				font: {
					size: 20,
					weight: 'bold',
				},
			},
		},
	};

	constructor(private readonly httpService: FireRepoLite) {}

	private mapFamiliesByDateToChart2(
		data: { date: Date; count: number }[],
	): ChartData<'bar'>[] {
		const arr: {
			datasets: { data: number[]; label: string }[];
		}[] = [
			{
				datasets: [
					{ data: [], label: 'Dec 8th', ...this.colorSettings },
				],
			},
			{
				datasets: [
					{ data: [], label: 'Dec 9th', ...this.colorSettings },
				],
			},
			{
				datasets: [
					{ data: [], label: 'Dec 11th', ...this.colorSettings },
				],
			},
			{
				datasets: [
					{ data: [], label: 'Dec 12th', ...this.colorSettings },
				],
			},
		];

		const getDayIndex = (date: Date): number => {
			switch (date.getDate()) {
				case 8:
					return 0;
				case 9:
					return 1;
				case 11:
					return 2;
				case 12:
					return 3;

				default:
					throw new Error('invalid date');
			}
		};

		data.forEach((e) => {
			const dayIndex = getDayIndex(e.date);
			arr[dayIndex].datasets[0].data.push(e.count);
		});

		return arr;
	}
}
