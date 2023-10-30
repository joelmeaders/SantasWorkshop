import { Component } from '@angular/core';

import { Chart, ChartConfiguration } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { COLLECTION_SCHEMA, UserStats } from '@santashop/models';
import { FireRepoLite, IFireRepoCollection } from '@santashop/core';
import { map, shareReplay } from 'rxjs';

Chart.register(ChartDataLabels);

@Component({
	selector: 'admin-user',
	templateUrl: './user.page.html',
	styleUrls: ['./user.page.scss'],
})
export class UserPage {
	private readonly statsCollection = <T>(): IFireRepoCollection<T> =>
		this.httpService.collection<T>(COLLECTION_SCHEMA.stats);

	private readonly userRecord$ = this.statsCollection<UserStats>()
		.read(`user-2023`)
		.pipe(shareReplay(1));

	public readonly referrers$ = this.userRecord$.pipe(
		map((data) => data.referrerCount),
		map((counts) => counts.sort((a, b) => b.count - a.count)),
		map((counts) => counts.slice(0, 10)),
		map((ref) => ref.map((r) => ({ label: r.referrer, data: [r.count] }))),
	);

	public readonly zipCodes$ = this.userRecord$.pipe(
		map((data) => data.zipCodeCount),
		map((counts) => counts.sort((a, b) => b.count - a.count)),
		map((counts) => counts.slice(0, 10)),
		map((ref) => ref.map((r) => ({ label: r.zip, data: [r.count] }))),
	);

	public barChartOptions: ChartConfiguration['options'] = {
		responsive: true,
		maintainAspectRatio: false,
		indexAxis: 'y',
		scales: {
			x: {
				min: 0,
			},
			y: {
				min: 0,
			},
		},
		layout: {
			padding: 0,
		},
		plugins: {
			legend: {
				display: false,
			},
			datalabels: {
				clamp: false,
				color: '#FFF',
				align: 'end',
				anchor: 'start',
				textAlign: 'start',
				textShadowColor: '#000',
				textShadowBlur: 5,
				font: {
					size: 16,
				},
				formatter: (_, ctx) => {
					console.log(ctx);
					return `${ctx.dataset?.data[0]} - ${ctx.dataset.label}`;
				},
			},
		},
	};

	public zipCodeChartOptions: ChartConfiguration['options'] = {
		responsive: true,
		maintainAspectRatio: false,
		indexAxis: 'y',
		scales: {
			x: {
				min: 0,
			},
			y: {
				min: 0,
			},
		},
		layout: {
			padding: 0,
		},
		plugins: {
			legend: {
				display: false,
			},
			datalabels: {
				clamp: false,
				color: '#FFF',
				align: 'end',
				anchor: 'start',
				textAlign: 'start',
				textShadowColor: '#000',
				textShadowBlur: 5,
				font: {
					size: 16,
				},
				formatter: (_, ctx) => {
					console.log(ctx);
					return `${ctx.dataset?.data[0]} Families - ${ctx.dataset.label}`;
				},
			},
		},
	};

	constructor(private readonly httpService: FireRepoLite) {}
}
