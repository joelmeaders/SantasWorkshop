import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Timestamp } from 'firebase/firestore';
import { ChartConfiguration } from 'chart.js';
import {
	BehaviorSubject,
	catchError,
	combineLatest,
	filter,
	map,
	of,
	shareReplay,
	startWith,
	switchMap,
} from 'rxjs';
import { FireRepoLite, PROGRAM_YEAR, SHOP_DAYS } from '@santashop/core';
import {
	CheckInAggregatedStats,
	CheckInDateTimeCount,
} from '@santashop/models';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import {
	getShopSchedule,
	getStatsCollection,
} from '../../../../shared/helpers';

import { FormsModule } from '@angular/forms';
import { AsyncPipe, DatePipe } from '@angular/common';
import {
	BaseChartDirective,
	provideCharts,
	withDefaultRegisterables,
} from 'ng2-charts';
import { addIcons } from 'ionicons';
import { refreshSharp } from 'ionicons/icons';
import {
	IonContent,
	IonGrid,
	IonRow,
	IonCol,
	IonItem,
	IonSelect,
	IonSelectOption,
	IonToolbar,
	IonButton,
	IonIcon,
	IonText,
	IonTitle,
	IonSpinner,
} from '@ionic/angular/standalone';

type CheckInStatsLoadState =
	| { status: 'loading' }
	| { status: 'empty' }
	| { status: 'error' }
	| { status: 'ready'; data: CheckInAggregatedStats };

type ReadyCheckInStatsState = Extract<
	CheckInStatsLoadState,
	{ status: 'ready' }
>;

@Component({
	selector: 'admin-check-in',
	templateUrl: './check-in.page.html',
	styleUrls: ['./check-in.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [provideCharts(withDefaultRegisterables())],
	imports: [
		HeaderComponent,
		FormsModule,
		BaseChartDirective,
		AsyncPipe,
		DatePipe,
		IonContent,
		IonGrid,
		IonRow,
		IonCol,
		IonItem,
		IonSelect,
		IonSelectOption,
		IonToolbar,
		IonButton,
		IonIcon,
		IonText,
		IonTitle,
		IonSpinner,
	],
})
export class CheckInPage {
	private readonly httpService = inject(FireRepoLite);
	private readonly programYear = inject(PROGRAM_YEAR);
	private readonly shopDays = inject(SHOP_DAYS, { optional: true }) ?? [];

	public readonly schedule = getShopSchedule(
		this.programYear,
		this.shopDays,
	);

	public year = this.programYear;
	public refreshYear = new BehaviorSubject<void>(undefined);

	public readonly checkInState$ = this.refreshYear.pipe(
		switchMap(() =>
			getStatsCollection<CheckInAggregatedStats>(this.httpService)
				.read(`checkin-${this.year}`)
				.pipe(
					map((data): CheckInStatsLoadState =>
						data ? { status: 'ready', data } : { status: 'empty' },
					),
					startWith<CheckInStatsLoadState>({ status: 'loading' }),
					catchError(() =>
						of<CheckInStatsLoadState>({ status: 'error' }),
					),
				),
		),
		shareReplay({ bufferSize: 1, refCount: true }),
	);

	private readonly checkInRecord$ = this.checkInState$.pipe(
		filter(
			(state): state is ReadyCheckInStatsState =>
				state.status === 'ready',
		),
		map((state) => state.data),
		shareReplay({ bufferSize: 1, refCount: true }),
	);

	public readonly hasData$ = this.checkInState$.pipe(
		filter((state) => state.status !== 'loading'),
		map((state) => state.status === 'ready'),
	);

	private readonly dateTimeStats$ = this.checkInRecord$.pipe(
		map((data) => data.dateTimeCount),
	);

	public readonly checkinLastUpdated$ = this.checkInRecord$.pipe(
		map((updated) => {
			const lastUpdated = updated.lastUpdated as Timestamp | Date;
			const date =
				lastUpdated instanceof Date
					? lastUpdated
					: lastUpdated.toDate();
			return date.toLocaleString();
		}),
	);

	public readonly totalCustomers$ = this.dateTimeStats$.pipe(
		map((data) =>
			data
				.map((e) => e.customerCount)
				.reduce((prev, curr) => prev + curr, 0),
		),
	);

	public readonly totalChildren$ = this.dateTimeStats$.pipe(
		map((data) =>
			data
				.map((e) => e.childCount)
				.reduce((prev, curr) => prev + curr, 0),
		),
	);

	public readonly totalPreregistered$ = this.dateTimeStats$.pipe(
		map((data) =>
			data
				.map((e) => e.pregisteredCount)
				.reduce((prev, curr) => prev + curr, 0),
		),
	);

	public readonly onSiteRegistrations$ = this.totalCustomers$.pipe(
		switchMap((total) =>
			this.totalPreregistered$.pipe(map((pre) => total - pre)),
		),
	);

	public readonly totalModifiedRegistrations$ = this.dateTimeStats$.pipe(
		map((data) =>
			data
				.map((e) => e.modifiedCount)
				.reduce((prev, curr) => prev + curr, 0),
		),
		switchMap((count) =>
			this.onSiteRegistrations$.pipe(map((onsite) => count - onsite)),
		),
		map((count) => (count > 0 ? count : count * -1)),
	);

	private readonly graphView = new BehaviorSubject<
		'customerCount' | 'childCount'
	>('customerCount');
	public readonly graphView$ = this.graphView
		.asObservable()
		.pipe(shareReplay(1));

	public readonly viewButtonText$ = this.graphView$.pipe(
		map((value) =>
			value === 'customerCount'
				? 'View by Children'
				: 'View by Check-Ins',
		),
	);

	// These chart groupings are schedule-driven and still require annual schedule data.
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

	constructor() {
		addIcons({ refreshSharp });
	}

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
		view: 'customerCount' | 'childCount',
	): CheckInChartData[] {
		data = data.sort((a, b) => a.date - b.date || a.hour - b.hour);

		const chartStructure = (
			inputData: number[],
			chartLabel: string,
			dataSeriesLabels: string[],
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

		const outputData: CheckInChartData[] = [];

		const days: number[] = this.getDays(data);

		days.forEach((day) => {
			const today = data.filter((e) => e.date === day);
			const dayData = today.map((e) => e[view]);
			const hours = this.getHourLabels(today);
			const chartData = chartStructure(
				dayData,
				`Dec ${day}, ${this.year}`,
				hours ?? [],
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

	public refresh(): void {
		this.refreshYear.next();
	}

	public addValues(values?: (number | [number, number] | null)[]): number {
		if (!values) return 0;
		return values.reduce((a: number, b) => {
			if (b === null) return a;
			if (Array.isArray(b)) return a + b[0];
			return a + b;
		}, 0);
	}
}

interface CheckInChartDataset {
	data: number[];
	label: string;
	backgroundColor: string[];
	borderColor: string[];
	borderWidth: number;
	dataSeriesLabels?: string[];
}

interface CheckInChartData {
	datasets: CheckInChartDataset[];
}
