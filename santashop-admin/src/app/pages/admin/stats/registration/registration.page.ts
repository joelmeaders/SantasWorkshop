import { EVENT_TIME_ZONE, getZonedDateParts } from '@santashop/models';
import { readState } from '../../../../shared/helpers/refreshable-read';
import { AdminReadRepository } from '../../../../shared/services/admin-read-repository.service';
import {
	Component,
	ChangeDetectionStrategy,
	computed,
	inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
	PROGRAM_YEAR,
	SHOP_DAYS,
	timestampToDate,
} from '@santashop/core/admin/firestore';
import {
	COLLECTION_SCHEMA,
	DateTimeSlot,
	RegistrationStats,
	ScheduleStats,
} from '@santashop/models';
import { BehaviorSubject, forkJoin, of, switchMap } from 'rxjs';

import { Chart, ChartConfiguration, ChartData } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import {
	getShopSchedule,
	getStatsCollection,
} from '../../../../shared/helpers';

import { DecimalPipe } from '@angular/common';
import {
	BaseChartDirective,
	provideCharts,
	withDefaultRegisterables,
} from 'ng2-charts';
import {
	IonCol,
	IonButton,
	IonContent,
	IonGrid,
	IonItem,
	IonRow,
	IonSelect,
	IonSelectOption,
	IonTitle,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { Timestamp, where } from 'firebase/firestore/lite';
import { ReportTableComponent } from '../../../../shared/components/report-table/report-table.component';
import { ReportFreshnessComponent } from '../../../../shared/components/report-freshness/report-freshness.component';
import {
	reportDate,
	ReportCell,
	ReportLabel,
} from '../../../../shared/helpers/report-export';

Chart.register(ChartDataLabels);

@Component({
	selector: 'admin-registration',
	templateUrl: './registration.page.html',
	styleUrls: ['./registration.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [provideCharts(withDefaultRegisterables())],
	imports: [
		ReportTableComponent,
		ReportFreshnessComponent,
		IonTitle,
		IonGrid,
		IonRow,
		IonCol,
		IonButton,
		IonContent,
		HeaderComponent,
		IonItem,
		IonSelect,
		IonSelectOption,
		BaseChartDirective,
		DecimalPipe,
		FormsModule,
	],
})
export class RegistrationPage {
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
			forkJoin({
				registration: getStatsCollection<RegistrationStats>(
					this.httpService,
				).read(`registration-${this.year}`),
				schedule: getStatsCollection<ScheduleStats>(
					this.httpService,
				).read(`schedule-${this.year}`),
				slots:
					this.year === this.programYear
						? this.httpService
								.collection<DateTimeSlot>(
									COLLECTION_SCHEMA.dateTimeSlots,
								)
								.readMany(
									[where('programYear', '==', this.year)],
									'id',
								)
						: of<DateTimeSlot[]>([]),
			}).pipe(readState()),
		),
	);
	public readonly state = toSignal(this.state$, {
		initialValue: { status: 'loading' as const, data: undefined },
	});
	public readonly operational = computed(
		() => this.state().data?.registration?.operational,
	);
	public readonly outcomeRows = computed<ReportCell[][]>(() => {
		const data = this.operational();
		if (!data) return [];
		const rows: [string, string, ReportCell][] = [
			[
				'All registrations',
				'All saved registrations for this year, including unfinished and canceled registrations.',
				data.registrationRecords,
			],
			[
				'Completed',
				'Submitted registrations that have not been canceled.',
				data.submittedRegistrations,
			],
			[
				'Not finished',
				'Registrations that have not been submitted or canceled.',
				data.draftRegistrations,
			],
			[
				'Canceled',
				'Registrations currently marked as canceled.',
				data.cancelledRegistrations,
			],
			[
				'Times canceled',
				'Every saved cancellation, including repeat cancellations of the same registration.',
				data.recordedCancellationEvents,
			],
			[
				'Checked in',
				'Completed registrations with a recorded check-in.',
				data.checkedInRegistrations,
			],
			[
				'Completion rate',
				'Completed registrations as a share of all saved registrations.',
				this.formatRate(data.completionRate),
			],
			[
				'Past appointments',
				'Completed, uncanceled appointments before the report update day (Denver time).',
				data.pastAppointmentRegistrations,
			],
			[
				'Attended',
				'Past appointments with a recorded check-in.',
				data.attendedPastAppointments,
			],
			[
				'No check-in recorded',
				'Past appointments without a recorded check-in. This does not confirm a no-show.',
				data.unconfirmedPastAppointments,
			],
			[
				'Check-in status missing',
				'Past appointments whose older records do not include a check-in status.',
				data.attendanceStatusUnavailable,
			],
			[
				'Attendance rate',
				'Past appointments with a check-in, divided by all past appointments.',
				this.formatRate(data.attendanceRate),
			],
			[
				'Appointment missing',
				'Completed registrations without a valid appointment in this year.',
				data.missingAppointmentRegistrations,
			],
			[
				'Submission date needs review',
				'Registrations with an unreadable submission date or a date after this report update.',
				data.invalidSubmissionDates,
			],
		];
		return rows.map(([label, description, value]) => [
			{ label, description },
			value,
		]);
	});
	public readonly appointmentColumns: ReportLabel[] = [
		{
			label: 'Appointment',
			description: 'Scheduled date and time in Denver.',
		},
		{
			label: 'Registrations',
			description: 'Registrations booked for this appointment.',
		},
	];
	public readonly zipColumns: ReportLabel[] = [
		{
			label: 'ZIP code',
			description: 'Home ZIP code from the registration.',
		},
		{
			label: 'Shoppers',
			description: 'Completed registrations with this ZIP code.',
		},
		{
			label: 'Children',
			description: 'Children included in those registrations.',
		},
	];
	public readonly snapshotColumns: ReportLabel[] = [
		{
			label: 'Day',
			description: 'Day this report was saved, in Denver time.',
		},
		{
			label: 'Report updated',
			description: 'Time the totals were calculated (UTC).',
		},
		{
			label: 'All registrations',
			description: 'All registrations saved that day.',
		},
		{ label: 'Completed', description: 'Submitted and not canceled.' },
		{
			label: 'Not finished',
			description: 'Not yet submitted or canceled.',
		},
		{ label: 'Canceled', description: 'Marked as canceled that day.' },
		{
			label: 'Checked in',
			description: 'Completed registrations with a check-in.',
		},
		{
			label: 'Completion rate',
			description:
				'Completed registrations divided by all registrations.',
		},
	];
	public readonly snapshotRows = computed<ReportCell[][]>(() =>
		[...(this.state().data?.registration?.dailySnapshots ?? [])]
			.sort((a, b) => a.dateKey.localeCompare(b.dateKey))
			.map((entry) => [
				entry.dateKey,
				reportDate(entry.calculatedAt)?.toISOString(),
				entry.registrationRecords,
				entry.submittedRegistrations,
				entry.draftRegistrations,
				entry.cancelledRegistrations,
				entry.checkedInRegistrations,
				this.formatRate(entry.completionRate),
			]),
	);
	public readonly zipRows = computed(() =>
		this.sortZipCodeCounts(this.registrationStats().zipCodeCount).map(
			(entry) => [String(entry.zip), entry.count, entry.childCount],
		),
	);
	public readonly zipTotals = computed(() => [
		'Total',
		this.registrationStats().zipCodeCount.reduce(
			(sum, row) => sum + row.count,
			0,
		),
		this.registrationStats().zipCodeCount.reduce(
			(sum, row) => sum + row.childCount,
			0,
		),
	]);
	public readonly appointmentRows = computed<ReportCell[][]>(() =>
		this.familiesBySlots().map((entry) => [
			entry.date.toLocaleString('en-US', {
				timeZone: EVENT_TIME_ZONE,
				dateStyle: 'medium',
				timeStyle: 'short',
			}),
			entry.count,
		]),
	);
	public readonly appointmentTotals = computed(() => [
		'Total',
		this.familiesBySlots().reduce((sum, row) => sum + row.count, 0),
	]);
	public readonly registrationExportContext = computed<ReportCell[][]>(() => [
		['Year', this.year],
		['Source', 'Nightly registration report'],
		[
			'Updated at (UTC)',
			reportDate(
				this.state().data?.registration?.calculatedAt,
			)?.toISOString(),
		],
	]);
	public readonly appointmentExportContext = computed<ReportCell[][]>(() => [
		['Year', this.year],
		[
			'Source',
			this.state().data?.schedule
				? 'Saved appointment totals'
				: 'Nightly registration report',
		],
		[
			'Updated at (UTC)',
			reportDate(
				this.state().data?.schedule
					? this.state().data?.schedule?.calculatedAt
					: this.state().data?.registration?.calculatedAt,
			)?.toISOString(),
		],
	]);

	private formatRate(value: number | undefined): string | undefined {
		return value === undefined || !Number.isFinite(value)
			? undefined
			: `${(value * 100).toFixed(1)}%`;
	}
	private readonly registrationStats = computed<RegistrationStats>(
		() =>
			this.state().data?.registration ?? {
				completedRegistrations: 0,
				dateTimeCount: [],
				zipCodeCount: [],
			},
	);
	private readonly dateTimeSlots = computed(() =>
		this.sortDateTimeSlots(
			(this.state().data?.slots ?? []).map((slot) => ({
				...slot,
				dateTime: timestampToDate(slot.dateTime),
			})),
		),
	);
	public readonly hasScheduleData = computed(() => {
		const data = this.state().data;
		return !!data?.schedule || !!data?.slots.length;
	});
	private readonly dateTimeStats = computed(() => {
		const data = this.state().data;
		return (
			data?.schedule?.dateTimeCounts ??
			data?.registration?.dateTimeCount ??
			[]
		);
	});
	public readonly registrationCount = computed(
		() => this.registrationStats().completedRegistrations,
	);
	public readonly registrationCountBySchedule = computed(() => {
		const data = this.state().data;
		return data?.schedule
			? data.schedule.dateTimeCounts.reduce(
					(total, slot) => total + slot.count,
					0,
				)
			: (data?.registration?.completedRegistrations ?? 0);
	});
	public readonly childCount = computed(() =>
		this.registrationStats().dateTimeCount.reduce(
			(total, slot) => total + slot.childCount,
			0,
		),
	);
	public readonly childrenPerCustomer = computed(() =>
		this.registrationCount()
			? this.childCount() / this.registrationCount()
			: 0,
	);
	private readonly stats = computed(() =>
		this.registrationStats().dateTimeCount.map((slot) => slot.stats),
	);
	public readonly statsNull = computed(
		() =>
			!this.stats().length ||
			this.stats().some(
				(stats) => !stats?.girls || !stats?.boys || !stats?.infants,
			),
	);
	public readonly girlBoyInfantCounts = computed(() => [
		this.demographicCount('girls'),
		this.demographicCount('boys'),
		this.demographicCount('infants'),
	]);
	public readonly familiesBySlots = computed(() =>
		this.sortFamiliesByDate(
			this.dateTimeStats().map((slot) => ({
				date: timestampToDate(slot.dateTime),
				count: slot.count,
			})),
		),
	);
	public readonly familiesBySlotsChartData = computed(() =>
		this.mapFamiliesByDateToChart2(this.familiesBySlots()),
	);
	public readonly topTenZipCodesCountData = computed<
		ChartData<'pie', number[], string | string[]>
	>(() => {
		const sorted = this.sortZipCodeCounts(
			this.registrationStats().zipCodeCount,
		);
		const data = sorted
			.slice(0, 4)
			.map((entry) => ({ zip: String(entry.zip), count: entry.count }));
		if (sorted.length > 4) {
			data.push({
				zip: 'Other',
				count: sorted
					.slice(4)
					.reduce((sum, entry) => sum + entry.count, 0),
			});
		}
		return {
			labels: data.map((entry) => [
				entry.zip.toString(),
				entry.count.toString() + ' Shoppers',
			]),
			datasets: [
				{
					data: data.map((entry) => entry.count),
					...this.colorSettings,
				},
			],
		};
	});

	private demographicCount(group: 'girls' | 'boys' | 'infants'): number {
		const stats = this.stats();
		if (stats.some((entry) => !entry?.[group])) return 0;
		return stats.reduce((total, entry) => total + entry[group].total, 0);
	}

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

	private readonly capacityColorSettings = {
		used: 'rgba(63, 81, 181, 0.85)',
		available: 'rgba(102, 187, 106, 0.8)',
		overflow: 'rgba(255, 99, 132, 0.85)',
		border: '#ffffff',
	};

	public readonly capacityByDay = computed(() =>
		this.mapSlotsToCapacityCharts(this.dateTimeSlots()),
	);

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
						return ctx.chart.data.labels[ctx.dataIndex] ?? '';
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
					const label = ctx.chart?.data?.labels?.[ctx.dataIndex];
					let labelText = '';

					if (Array.isArray(label)) {
						labelText = label.join(' ');
					} else if (typeof label === 'string') {
						labelText = label;
					}

					return `${value} ${labelText}`;
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
				max: 450,
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

	// Update yearly. Last updated 2024
	private mapFamiliesByDateToChart2(
		data: { date: Date; count: number }[],
	): ChartData<'bar', number[], string>[] {
		const defaults = (
			label: string,
		): ChartData<'bar', number[], string> => ({
			datasets: [{ data: [], ...this.colorSettings, label }],
		});

		const schedule = this.schedule.find((s) => s.year === this.year);
		if (!schedule) return [];

		const arr: ChartData<'bar', number[], string>[] = [
			{ ...defaults(this.friendlyDay(schedule.days[0])) },
			{ ...defaults(this.friendlyDay(schedule.days[1])) },
			{ ...defaults(this.friendlyDay(schedule.days[2])) },
			{ ...defaults(this.friendlyDay(schedule.days[3])) },
		];

		// Update yearly. Last updated 2024
		const getDayIndex = (date: Date): number => {
			const day = getZonedDateParts(date).day;
			return schedule.days.indexOf(day);
		};

		data.forEach((e) => {
			const dayIndex = getDayIndex(e.date);
			if (dayIndex >= 0) arr[dayIndex].datasets[0].data.push(e.count);
		});

		return arr;
	}

	private sortDateTimeSlots(slots: DateTimeSlot[]): DateTimeSlot[] {
		const sortedSlots = [...slots];

		sortedSlots.sort(
			(a: DateTimeSlot, b: DateTimeSlot) =>
				(a.dateTime as Date).valueOf() - (b.dateTime as Date).valueOf(),
		);

		return sortedSlots;
	}

	private sortFamiliesByDate(
		data: { date: Date; count: number }[],
	): { date: Date; count: number }[] {
		const sortedFamilies = [...data];

		sortedFamilies.sort(
			(
				a: { date: Date; count: number },
				b: { date: Date; count: number },
			) => Number(a.date) - Number(b.date),
		);

		return sortedFamilies;
	}

	private sortZipCodeCounts<
		T extends {
			count: number;
		},
	>(data: T[]): T[] {
		const sortedCounts = [...data];

		sortedCounts.sort((a: T, b: T) => b.count - a.count);

		return sortedCounts;
	}

	private friendlyDay(day: number): string {
		const j = day % 10;
		const k = day % 100;

		if (j === 1 && k !== 11) {
			return day + 'st';
		}

		if (j === 2 && k !== 12) {
			return day + 'nd';
		}

		if (j === 3 && k !== 13) {
			return day + 'rd';
		}

		return day + 'th';
	}

	public getTotalCount(data: (number | [number, number] | null)[]): number {
		return data.reduce((a: number, b) => {
			if (b === null) return a;
			if (Array.isArray(b)) return a + b[0];
			return a + b;
		}, 0);
	}

	private mapSlotsToCapacityCharts(
		slots: DateTimeSlot[],
	): DayCapacityChart[] {
		// Annual reset removes slots; saved stats do not contain appointment limits.
		if (this.year !== this.programYear || slots.length === 0) return [];
		const schedule = this.schedule.find((s) => s.year === this.year);
		if (!schedule) return [];

		const grouped = slots.reduce<Map<number, DateTimeSlot[]>>(
			(acc, slot) => {
				const date =
					slot.dateTime instanceof Date
						? slot.dateTime
						: (slot.dateTime as Timestamp).toDate();
				const day = getZonedDateParts(date).day;
				const existing = acc.get(day) ?? [];
				existing.push(slot);
				acc.set(day, existing);
				return acc;
			},
			new Map(),
		);

		return schedule.days.map((day) => {
			const label = this.friendlyDay(day);
			const daySlots = grouped.get(day) ?? [];
			const dateValue = daySlots[0]
				? (daySlots[0].dateTime as Date)
				: undefined;
			const dateLabel = dateValue
				? (dateValue as Date).toLocaleDateString('en-US', {
						timeZone: EVENT_TIME_ZONE,
						month: 'short',
						day: 'numeric',
					})
				: '';
			const stats = daySlots.reduce(
				(acc, slot) => {
					const max = slot.maxSlots ?? 0;
					const used = slot.slotsReserved ?? 0;
					acc.total += max;
					acc.used += used;
					return acc;
				},
				{ used: 0, total: 0 },
			);

			const overflow = Math.max(stats.used - stats.total, 0);
			const usedWithinCapacity = Math.min(stats.used, stats.total);
			const remaining = Math.max(stats.total - usedWithinCapacity, 0);
			const percent =
				stats.total === 0 ? 0 : (stats.used / stats.total) * 100;

			return {
				label,
				dateLabel,
				percent,
				used: stats.used,
				total: stats.total,
				remaining,
				overflow,
				chartData: this.buildCapacityChartData(
					usedWithinCapacity,
					remaining,
					overflow,
				),
			};
		});
	}

	private buildCapacityChartData(
		used: number,
		remaining: number,
		overflow: number,
	): ChartData<'doughnut', number[], string | string[]> {
		const labels =
			overflow > 0 ? ['Used', 'Overflow'] : ['Used', 'Remaining'];
		const data = overflow > 0 ? [used, overflow] : [used, remaining];
		const backgroundColor =
			overflow > 0
				? [
						this.capacityColorSettings.used,
						this.capacityColorSettings.overflow,
					]
				: [
						this.capacityColorSettings.used,
						this.capacityColorSettings.available,
					];
		const borderColor = new Array(labels.length).fill(
			this.capacityColorSettings.border,
		);

		return {
			labels,
			datasets: [
				{
					data,
					backgroundColor,
					borderColor,
					borderWidth: 1,
				},
			],
		};
	}
}

interface DayCapacityChart {
	label: string;
	dateLabel: string;
	percent: number;
	used: number;
	total: number;
	remaining: number;
	overflow: number;
	chartData: ChartData<'doughnut', number[], string | string[]>;
}
