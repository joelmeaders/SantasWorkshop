import {
	AdminChartPipe,
	AdminChartOptionsPipe,
} from '../../../../shared/preferences/admin-chart.pipe';
import { AdminTextPipe } from '../../../../shared/preferences/admin-text.pipe';
import { readState } from '../../../../shared/helpers/refreshable-read';
import { AdminReadRepository } from '../../../../shared/services/admin-read-repository.service';
import {
	Component,
	computed,
	inject,
	ChangeDetectionStrategy,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { Chart, ChartConfiguration } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { UserStats } from '@santashop/models';
import { PROGRAM_YEAR, SHOP_DAYS } from '@santashop/core/admin/firestore';
import { BehaviorSubject, switchMap } from 'rxjs';
import { ReportTableComponent } from '../../../../shared/components/report-table/report-table.component';
import { ReportFreshnessComponent } from '../../../../shared/components/report-freshness/report-freshness.component';
import {
	reportDate,
	ReportCell,
	ReportLabel,
} from '../../../../shared/helpers/report-export';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import {
	getShopSchedule,
	getStatsCollection,
} from '../../../../shared/helpers';

import {
	BaseChartDirective,
	provideCharts,
	withDefaultRegisterables,
} from 'ng2-charts';
import {
	IonButton,
	IonContent,
	IonGrid,
	IonRow,
	IonCol,
	IonToolbar,
	IonTitle,
	IonItem,
	IonSelect,
	IonSelectOption,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';

Chart.register(ChartDataLabels);

@Component({
	selector: 'admin-user',
	templateUrl: './user.page.html',
	styleUrls: ['./user.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [provideCharts(withDefaultRegisterables())],
	imports: [
		AdminChartPipe,
		AdminChartOptionsPipe,
		AdminTextPipe,
		ReportTableComponent,
		ReportFreshnessComponent,
		HeaderComponent,
		BaseChartDirective,
		FormsModule,
		IonButton,
		IonContent,
		IonGrid,
		IonRow,
		IonCol,
		IonToolbar,
		IonTitle,
		IonItem,
		IonSelect,
		IonSelectOption,
	],
})
export class UserPage {
	private readonly httpService = inject(AdminReadRepository);
	public readonly programYear = inject(PROGRAM_YEAR);
	private readonly shopDays = inject(SHOP_DAYS, { optional: true }) ?? [];

	public readonly schedule = getShopSchedule(this.programYear, this.shopDays);

	public year = this.programYear;
	public refreshYear = new BehaviorSubject<void>(undefined);

	public refresh(): void {
		this.refreshYear.next();
	}

	public ionViewWillEnter(): void {
		this.refresh();
	}

	private readonly state$ = this.refreshYear.pipe(
		switchMap(() =>
			getStatsCollection<UserStats>(this.httpService)
				.read(`user-${this.year}`)
				.pipe(readState()),
		),
	);
	public readonly state = toSignal(this.state$, {
		initialValue: { status: 'loading' as const, data: undefined },
	});

	public readonly userRecord = computed(() => this.state().data);
	public readonly referralColumns: ReportLabel[] = [
		{
			label: 'How they heard about us',
			description: 'The source each shopper chose when signing up.',
		},
		{
			label: 'Shoppers',
			description: 'Shopper profiles with this answer.',
		},
	];
	public readonly zipColumns: ReportLabel[] = [
		{
			label: 'ZIP code',
			description: 'Home ZIP code from the shopper profile.',
		},
		{
			label: 'Shoppers',
			description: 'Shopper profiles with this ZIP code.',
		},
	];
	public readonly signupColumns: ReportLabel[] = [
		{
			label: 'Profile created',
			description: 'Day the shopper profile was created, in Denver time.',
		},
		{
			label: 'Shoppers',
			description: 'Highest saved count for this profile creation day.',
		},
	];
	public readonly referralRows = computed(() =>
		[...(this.userRecord()?.referrerCount ?? [])]
			.sort((a, b) => b.count - a.count)
			.map((entry) => [entry.referrer || 'Unknown', entry.count]),
	);
	public readonly zipRows = computed(() =>
		[...(this.userRecord()?.zipCodeCount ?? [])]
			.sort((a, b) => b.count - a.count)
			.map((entry) => [entry.zip || 'Unknown', entry.count]),
	);
	public readonly referralTotal = computed(() => [
		'Total',
		(this.userRecord()?.referrerCount ?? []).reduce(
			(sum, row) => sum + row.count,
			0,
		),
	]);
	public readonly zipTotal = computed(() => [
		'Total',
		(this.userRecord()?.zipCodeCount ?? []).reduce(
			(sum, row) => sum + row.count,
			0,
		),
	]);
	public readonly signupRows = computed(() =>
		[...(this.userRecord()?.dailySignups ?? [])]
			.sort((a, b) => a.dateKey.localeCompare(b.dateKey))
			.map((entry) => [entry.dateKey, entry.count]),
	);
	public readonly exportContext = computed<ReportCell[][]>(() => [
		['Year', this.year],
		[
			'Updated at (UTC)',
			reportDate(this.userRecord()?.calculatedAt)?.toISOString(),
		],
		[
			'Includes',
			this.userRecord()?.population === 'all-users'
				? 'All saved shopper profiles'
				: 'Older totals may leave out shoppers without a ZIP code or referral',
		],
	]);
	public readonly signupExportContext = computed<ReportCell[][]>(() => [
		['Year', this.year],
		[
			'Updated at (UTC)',
			reportDate(this.userRecord()?.calculatedAt)?.toISOString(),
		],
		[
			'Includes',
			'Highest saved shopper count for each profile creation day, including profiles later removed',
		],
		[
			'Counting notes',
			'Profiles removed before a report ran are not counted. Saved daily counts may exceed the current shopper total.',
		],
		[
			'Shopper profiles with missing creation dates',
			this.userRecord()?.signupDatesUnavailable,
		],
		[
			'Shopper profiles created in other years',
			this.userRecord()?.signupDatesOutsideProgramYear,
		],
	]);

	public readonly referrers = computed(() =>
		[...(this.userRecord()?.referrerCount ?? [])]
			.sort((a, b) => b.count - a.count)
			.slice(0, 10)
			.map((ref) => ({ label: ref.referrer, data: [ref.count] })),
	);

	public readonly zipCodes = computed(() =>
		[...(this.userRecord()?.zipCodeCount ?? [])]
			.sort((a, b) => b.count - a.count)
			.slice(0, 10)
			.map((ref) => ({ label: ref.zip, data: [ref.count] })),
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
					return `${ctx.dataset?.data[0]} Shoppers - ${ctx.dataset.label}`;
				},
			},
		},
	};
}
