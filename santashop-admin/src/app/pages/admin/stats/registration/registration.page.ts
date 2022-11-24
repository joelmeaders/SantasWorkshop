import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FireRepoLite, IFireRepoCollection } from '@core/*';
import { COLLECTION_SCHEMA, RegistrationStats } from '@models/*';
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
			.read('registration-2022')
			.pipe(shareReplay(1));

	public readonly registrationCount$ = this.registrationStats$.pipe(
		map((stats) => stats.completedRegistrations)
	);

	private readonly dateTimeStats$ = this.registrationStats$.pipe(
		map((allData) => allData.dateTimeCount)
	);

	public readonly childCount$ = this.registrationStats$.pipe(
		map((stats) => stats.dateTimeCount.map((e) => e.childCount)),
		map((counts) => counts.reduce((a, b) => a + b, 0))
	);

	public readonly childrenPerCustomer$ = combineLatest([
		this.registrationCount$,
		this.childCount$,
	]).pipe(map((data) => data[1] / data[0]));

	private readonly stats$ = this.dateTimeStats$.pipe(
		map((dateTimes) => dateTimes.map((e) => e.stats))
	);

	public readonly boyCount$ = this.stats$.pipe(
		map((stats) => stats.map((e) => e.boys)),
		map((boys) => boys.reduce((a, b) => a + b.total, 0))
	);

	public readonly girlCount$ = this.stats$.pipe(
		map((stats) => stats.map((e) => e.girls)),
		map((girls) => girls.reduce((a, b) => a + b.total, 0))
	);

	public readonly infantCount$ = this.stats$.pipe(
		map((stats) => stats.map((e) => e.infants)),
		map((infants) => infants.reduce((a, b) => a + b.total, 0))
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
			}))
		),
		map((data) => data.sort((a, b) => Number(a.date) - Number(b.date)))
	);

	public readonly familiesBySlotsChartData$ = this.familiesBySlots$.pipe(
		map((data) => this.mapFamiliesByDateToChart(data))
	);

	private readonly zipCodeStats$ = this.registrationStats$.pipe(
		map((allData) => allData.zipCodeCount)
	);

	public readonly topFiveZipCodesCount$ = this.zipCodeStats$.pipe(
		map((data) => data.sort((a, b) => b.count - a.count)),
		map((data) => data.slice(0, 4))
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
						datalabels: { font: { size: 16, weight: 'bold' } },
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
		})
	);

	public pieChartOptions: ChartConfiguration['options'] = {
		responsive: true,
		plugins: {
			legend: {
				display: true,
				position: 'top',
			},
			datalabels: {
				formatter: (_, ctx) => {
					if (ctx.chart.data.labels) {
						return ctx.chart.data.labels[ctx.dataIndex];
					}
				},
			},
		},
	};

	constructor(private readonly httpService: FireRepoLite) {}

	private mapFamiliesByDateToChart(
		data: { date: Date; count: number }[]
	): { data: number[]; label: string }[] {
		const arr: { data: number[]; label: string }[] = [
			{ data: [], label: '10am' },
			{ data: [], label: '11am' },
			{ data: [], label: '12pm' },
			{ data: [], label: '1pm' },
			{ data: [], label: '2pm' },
		];

		let days = 0;

		data.forEach((e, i) => {
			if (i > 0 && i % 5 === 0) days++;
			arr[i - days * 5].data.push(e.count);
			console.log(
				`adding ${e.count} to day ${days} slot ${i - days * 5}`
			);
		});

		return arr;
	}
}
