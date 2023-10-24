/* eslint-disable @typescript-eslint/naming-convention */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';
import { ChartConfiguration, ChartData } from 'chart.js';
import {
	BehaviorSubject,
	combineLatest,
	map,
	shareReplay,
	switchMap,
} from 'rxjs';
import {
	IFireRepoCollection,
	FireRepoLite,
	filterNil
} from '@core/*';
import {
	CheckInAggregatedStats,
	CheckInDateTimeCount,
	COLLECTION_SCHEMA,
} from '@models/*';

@Component({
	selector: 'admin-check-in',
	templateUrl: './check-in.page.html',
	styleUrls: ['./check-in.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckInPage {
	public year = 2023;
	public refreshYear = new BehaviorSubject<void>(undefined);

	private readonly statsCollection = <T>(): IFireRepoCollection<T> =>
		this.httpService.collection<T>(COLLECTION_SCHEMA.stats);

	private readonly checkInRecord$ = this.refreshYear.pipe(
		switchMap(() =>
			this.statsCollection<CheckInAggregatedStats>()
				.read(`checkin-${this.year}`)
				.pipe(shareReplay(1))
		)
	);

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
		),
		switchMap((count) =>
			this.onSiteRegistrations$.pipe(map((onsite) => count - onsite))
		),
		map((count) => (count > 0 ? count : count * -1))
	);

	private readonly graphView = new BehaviorSubject<
		'customerCount' | 'childCount'
	>('customerCount');
	public readonly graphView$ = this.graphView
		.asObservable()
		.pipe(shareReplay(1));

	public readonly viewButtonText$ = this.graphView$.pipe(
		map((value) => (value === 'customerCount' ? 'Children' : 'Check-Ins'))
	);

	// TODO: These should be redone to not need udated every year...
	public readonly checkInsByDayHour$ = combineLatest([
		this.dateTimeStats$,
		this.graphView$,
	]).pipe(map(([data, view]) => this.mapDaysHoursToChart(data, view)));

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

	private getDays(data: CheckInDateTimeCount[]): number[] {
		return Array.from(new Set(data.map((e) => e.date)));
	}

	private getHourLabels(data: CheckInDateTimeCount[]): string[] {
		const hourFix = (hour: number): number =>
			hour <= 12 ? hour : hour - 12;
		const amPm = (hour: number): string => {
			return hour < 12 ? 'am' : 'pm';
		};
		return data.map((e) => `${hourFix(e.hour)}${amPm(e.hour)}`);
	}

	private mapDaysHoursToChart(
		data: CheckInDateTimeCount[],
		view: 'customerCount' | 'childCount'
	): ChartData<'bar'>[] {
		data = data.sort((a, b) => a.date - b.date || a.hour - b.hour);

		const chartStructure = (
			inputData: number[],
			chartLabel: string,
			dataSeriesLabels: string[]
		): {
			datasets: {
				backgroundColor: string[];
				borderColor: string[];
				borderWidth: number;
				data: number[];
				label: string;
				dataSeriesLabels?: string[];
			}[];
		} => ({
			datasets: [
				{
					data: inputData,
					label: chartLabel,
					...this.colorSettings,
					dataSeriesLabels,
				},
			],
		});

		const outputData: {
			datasets: {
				data: number[];
				label: string;
				dataSeriesLabels?: string[];
			}[];
		}[] = [];

		const days: number[] = this.getDays(data);

		days.forEach((day) => {
			const today = data.filter((e) => e.date === day);
			const dayData = today.map((e) => e[view]);
			const hours = this.getHourLabels(today);
			const chartData = chartStructure(
				dayData,
				`Dec ${day}, ${this.year}`,
				hours ?? []
			);
			outputData.push(chartData);
		});

		return outputData;
	}

	public switchView(): void {
		if (this.graphView.getValue() === 'customerCount') {
			this.graphView.next('childCount');
		} else {
			this.graphView.next('customerCount');
		}
	}

	public addValues(values?: number[]): number {
		if (!values) return 0;
		return values.reduce((a, b) => a + b);
	}
}
