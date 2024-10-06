import { Component } from '@angular/core';

import { Chart, ChartConfiguration } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { COLLECTION_SCHEMA, UserStats } from '@santashop/models';
import { FireRepoLite, IFireRepoCollection, filterNil } from '@santashop/core';
import { map, shareReplay } from 'rxjs';
import { HeaderComponent } from '../../../../shared/components/header/header.component';

import { NgIf, AsyncPipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import {
	IonContent,
	IonGrid,
	IonRow,
	IonCol,
	IonToolbar,
	IonTitle,
} from '@ionic/angular/standalone';

Chart.register(ChartDataLabels);

@Component({
	selector: 'admin-user',
	templateUrl: './user.page.html',
	styleUrls: ['./user.page.scss'],
	standalone: true,
	imports: [
		HeaderComponent,
		NgIf,
		BaseChartDirective,
		AsyncPipe,
		IonContent,
		IonGrid,
		IonRow,
		IonCol,
		IonToolbar,
		IonTitle,
	],
})
export class UserPage {
	private readonly statsCollection = <T>(): IFireRepoCollection<T> =>
		this.httpService.collection<T>(COLLECTION_SCHEMA.stats);

	private readonly userRecord$ = this.statsCollection<UserStats>()
		.read(`user-2024`)
		.pipe(filterNil(), shareReplay(1));

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
				textStrokeColor: '#000',
				textStrokeWidth: 2,
				font: {
					size: 20,
					weight: 'bold',
				},
				formatter: (_, ctx) => {
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
				textStrokeColor: '#000',
				textStrokeWidth: 2,
				font: {
					size: 20,
					weight: 'bold',
				},
				formatter: (_, ctx) => {
					return `${ctx.dataset?.data[0]} Families - ${ctx.dataset.label}`;
				},
			},
		},
	};

	constructor(private readonly httpService: FireRepoLite) {}
}
