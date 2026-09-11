import { AdminReadRepository } from '../../../../shared/services/admin-read-repository.service';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ChartConfiguration } from 'chart.js';
import {
	BehaviorSubject,
	catchError,
	map,
	of,
	startWith,
	switchMap,
} from 'rxjs';
import { PROGRAM_YEAR, SHOP_DAYS } from '@santashop/core/admin/firestore';
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
import {
	BaseChartDirective,
	provideCharts,
	withDefaultRegisterables,
} from 'ng2-charts';
import { addIcons } from 'ionicons';
import { refreshSharp } from 'ionicons/icons';
import { ReportTableComponent } from '../../../../shared/components/report-table/report-table.component';
import { ReportFreshnessComponent } from '../../../../shared/components/report-freshness/report-freshness.component';
import {
	reportDate,
	ReportCell,
} from '../../../../shared/helpers/report-export';
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

@Component({
	selector: 'admin-check-in',
	templateUrl: './check-in.page.html',
	styleUrls: ['./check-in.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [provideCharts(withDefaultRegisterables())],
	imports: [
		ReportTableComponent,
		ReportFreshnessComponent,
		HeaderComponent,
		FormsModule,
		BaseChartDirective,
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
	private readonly httpService = inject(AdminReadRepository);
	public readonly programYear = inject(PROGRAM_YEAR);
	private readonly shopDays = inject(SHOP_DAYS, { optional: true }) ?? [];

	public readonly schedule = getShopSchedule(this.programYear, this.shopDays);

	public year = this.programYear;
	public refreshYear = new BehaviorSubject<void>(undefined);

	private readonly checkInState$ = this.refreshYear.pipe(
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
	);
	public readonly checkInState = toSignal(this.checkInState$, {
		initialValue: { status: 'loading' as const },
	});
	private readonly checkInRecord = computed(() => {
		const state = this.checkInState();
		return state.status === 'ready' ? state.data : undefined;
	});
	public readonly hasData = computed(
		() => this.checkInState().status === 'ready',
	);
	private readonly dateTimeStats = computed(
		() => this.checkInRecord()?.dateTimeCount ?? [],
	);
	public readonly checkinLastUpdated = computed(() =>
		reportDate(this.checkInRecord()?.lastUpdated),
	);
	public readonly hasLegacyDateBuckets = computed(() =>
		this.dateTimeStats().some((entry) => !entry.dateKey),
	);
	public readonly attendanceRows = computed<ReportCell[][]>(() =>
		[...this.dateTimeStats()]
			.sort(
				(a, b) =>
					this.getDateKey(a).localeCompare(this.getDateKey(b)) ||
					a.hour - b.hour,
			)
			.map((entry) => [
				this.getDateKey(entry),
				`${String(entry.hour).padStart(2, '0')}:00`,
				entry.customerCount,
				entry.childCount,
				entry.pregisteredCount,
				entry.customerCount - entry.pregisteredCount,
				entry.modifiedCount,
			]),
	);
	public readonly attendanceTotals = computed(() => [
		'Total',
		'',
		this.totalCustomers(),
		this.totalChildren(),
		this.totalPreregistered(),
		this.onSiteRegistrations(),
		this.dateTimeStats().reduce((sum, row) => sum + row.modifiedCount, 0),
	]);
	public readonly exportContext = computed<ReportCell[][]>(() => [
		['Program year', this.year],
		['Calculated at', this.checkinLastUpdated()?.toISOString()],
		[
			'Date coverage',
			this.hasLegacyDateBuckets()
				? 'Buckets without a saved date key use the legacy December convention'
				: 'Saved local date keys',
		],
	]);
	public readonly totalCustomers = computed(() =>
		this.dateTimeStats().reduce(
			(total, entry) => total + entry.customerCount,
			0,
		),
	);
	public readonly totalChildren = computed(() =>
		this.dateTimeStats().reduce(
			(total, entry) => total + entry.childCount,
			0,
		),
	);
	public readonly totalPreregistered = computed(() =>
		this.dateTimeStats().reduce(
			(total, entry) => total + entry.pregisteredCount,
			0,
		),
	);
	public readonly onSiteRegistrations = computed(
		() => this.totalCustomers() - this.totalPreregistered(),
	);
	public readonly totalModifiedRegistrations = computed(() => {
		const count = this.dateTimeStats().reduce(
			(total, entry) => total + entry.modifiedCount,
			0,
		);
		const difference = count - this.onSiteRegistrations();
		return difference > 0 ? difference : difference * -1;
	});
	public readonly graphView = signal<'customerCount' | 'childCount'>(
		'customerCount',
	);
	public readonly viewButtonText = computed(() =>
		this.graphView() === 'customerCount'
			? 'View by Children'
			: 'View by Check-Ins',
	);
	public readonly checkInsByDayHour = computed(() =>
		this.mapDaysHoursToChart(this.dateTimeStats(), this.graphView()),
	);

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

	private getDateKey(entry: CheckInDateTimeCount): string {
		const dateKey = entry.dateKey;
		if (
			dateKey &&
			/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(dateKey)
		) {
			return dateKey;
		}

		return `${this.year}-12-${entry.date.toString().padStart(2, '0')}`;
	}

	private formatDateKey(dateKey: string): string {
		const [year, month, day] = dateKey.split('-').map(Number);
		const monthName = new Intl.DateTimeFormat('en-US', {
			month: 'short',
			timeZone: 'UTC',
		}).format(new Date(Date.UTC(year, month - 1, 1)));
		return `${monthName} ${day}, ${year}`;
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
		const sortedData = [...data].sort(
			(a, b) =>
				this.getDateKey(a).localeCompare(this.getDateKey(b)) ||
				a.hour - b.hour,
		);

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

		const dateKeys = Array.from(
			new Set(sortedData.map((entry) => this.getDateKey(entry))),
		);

		dateKeys.forEach((dateKey) => {
			const today = sortedData.filter(
				(entry) => this.getDateKey(entry) === dateKey,
			);
			const dayData = today.map((e) => e[view]);
			const hours = this.getHourLabels(today);
			const chartData = chartStructure(
				dayData,
				this.formatDateKey(dateKey),
				hours ?? [],
			);
			outputData.push(chartData);
		});

		return outputData;
	}

	public switchView(): void {
		if (this.graphView() === 'customerCount') {
			this.graphView.set('childCount');
		} else {
			this.graphView.set('customerCount');
		}
	}

	public ionViewWillEnter(): void {
		this.refresh();
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
