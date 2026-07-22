import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import {
	FireRepoLite,
	IFireRepoCollection,
	filterNil,
	shopSchedule,
	timestampToDate,
} from '@santashop/core';
import {
	COLLECTION_SCHEMA,
	DateTimeSlot,
	RegistrationStats,
	ScheduleStats,
} from '@santashop/models';
import {
	BehaviorSubject,
	catchError,
	combineLatest,
	defaultIfEmpty,
	map,
	Observable,
	of,
	shareReplay,
	switchMap,
} from 'rxjs';

import { Chart, ChartConfiguration, ChartData } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { HeaderComponent } from '../../../../shared/components/header/header.component';

import { AsyncPipe, DecimalPipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import {
	IonCol,
	IonContent,
	IonGrid,
	IonItem,
	IonRow,
	IonSelect,
	IonSelectOption,
	IonTitle,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { QueryConstraint, Timestamp, where } from 'firebase/firestore';

Chart.register(ChartDataLabels);

@Component({
	selector: 'admin-registration',
	templateUrl: './registration.page.html',
	styleUrls: ['./registration.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		IonTitle,
		IonGrid,
		IonRow,
		IonCol,
		IonContent,
		HeaderComponent,
		IonItem,
		IonSelect,
		IonSelectOption,
		BaseChartDirective,
		AsyncPipe,
		DecimalPipe,
		FormsModule,
	],
})
export class RegistrationPage {
	private readonly httpService = inject(FireRepoLite);

	public readonly schedule = shopSchedule;

	public year = 2025;
	public refreshYear = new BehaviorSubject<void>(undefined);

	private readonly statsCollection = <T>(): IFireRepoCollection<T> =>
		this.httpService.collection<T>(COLLECTION_SCHEMA.stats);

	private readonly dateTimeSlotCollection =
		(): IFireRepoCollection<DateTimeSlot> =>
			this.httpService.collection<DateTimeSlot>(
				COLLECTION_SCHEMA.dateTimeSlots,
			);

	private readonly registrationStats$ = this.refreshYear.pipe(
		switchMap(() =>
			this.statsCollection<RegistrationStats>()
				.read(`registration-${this.year}`)
				.pipe(filterNil(), shareReplay(1)),
		),
	);

	private readonly scheduleStats$ = this.refreshYear.pipe(
		switchMap(() =>
			this.statsCollection<ScheduleStats>()
				.read(`schedule-${this.year}`)
				.pipe(shareReplay(1)),
		),
	);

	private readonly dateTimeSlots$ = this.refreshYear.pipe(
		switchMap(() => {
			const queryConstraints: QueryConstraint[] = [
				where('programYear', '==', this.year),
			];

			return this.dateTimeSlotCollection()
				.readMany(queryConstraints, 'id')
				.pipe(
					map((slots) =>
						slots.map((slot) => ({
							...slot,
							dateTime:
								slot.dateTime instanceof Date
									? slot.dateTime
									: timestampToDate(slot.dateTime),
						})),
					),
					map((slots) => this.sortDateTimeSlots(slots)),
				);
		}),
		shareReplay(1),
	);

	public readonly hasScheduleData$ = this.scheduleStats$.pipe(
		map((schedule) => !!schedule),
	);

	private readonly dateTimeStats$ = this.scheduleStats$.pipe(
		filterNil(),
		map((allData) => allData.dateTimeCounts),
	);

	public readonly registrationCount$ = this.registrationStats$.pipe(
		map((stats) => stats.completedRegistrations),
		defaultIfEmpty(0),
	);

	public readonly registrationCountBySchedule$ = this.dateTimeStats$.pipe(
		map((stats) => stats.map((s) => s.count)),
		map((stats) => stats.reduce((a, c) => a + c, 0)),
		defaultIfEmpty(0),
	);

	public readonly childCount$ = this.registrationStats$.pipe(
		map((stats) => stats.dateTimeCount.map((e) => e.childCount)),
		map((counts) => counts.reduce((a, b) => a + b, 0)),
	);

	public readonly childrenPerCustomer$ = combineLatest([
		this.registrationCount$,
		this.childCount$,
	]).pipe(map((data) => data[1] / data[0]));

	public readonly stats$ = this.registrationStats$.pipe(
		map((stats) => stats?.dateTimeCount),
		map((dateTimes) => dateTimes.map((e) => e.stats)),
	);

	public readonly statsNull$ = this.stats$.pipe(
		map((stats) => stats.every((s) => !s)),
	);

	public readonly boyCount$ = this.stats$.pipe(
		map((stats) => stats.map((e) => e.boys)),
		map((boys) => boys.reduce((a, b) => a + b.total, 0)),
		catchError(() => of(0)),
		defaultIfEmpty(0),
	);

	public readonly girlCount$ = this.stats$.pipe(
		map((stats) => stats.map((e) => e.girls)),
		map((girls) => girls.reduce((a, b) => a + b.total, 0)),
		catchError(() => of(0)),
		defaultIfEmpty(0),
	);

	public readonly infantCount$ = this.stats$.pipe(
		map((stats) => stats.map((e) => e.infants)),
		map((infants) => infants.reduce((a, b) => a + b.total, 0)),
		catchError(() => of(0)),
		defaultIfEmpty(0),
	);

	public readonly girlBoyInfantCounts$ = combineLatest([
		this.girlCount$,
		this.boyCount$,
		this.infantCount$,
	]);

	public readonly familiesBySlots$ = this.dateTimeStats$.pipe(
		map((dateTimes) =>
			dateTimes.map((e) => {
				const dateTime = e.dateTime as Timestamp | Date;
				const date =
					dateTime instanceof Date ? dateTime : dateTime.toDate();
				return { date, count: e.count };
			}),
		),
		map((data) => this.sortFamiliesByDate(data)),
	);

	public readonly familiesBySlotsChartData$ = this.familiesBySlots$.pipe(
		map((data) => this.mapFamiliesByDateToChart2(data)),
	);

	private readonly zipCodeStats$ = this.registrationStats$.pipe(
		map((allData) => allData.zipCodeCount),
	);

	public readonly topFiveZipCodesCount$ = this.zipCodeStats$.pipe(
		map((data) => this.sortZipCodeCounts(data)),
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

			data.forEach((e: { zip: string | number; count: number }) => {
				if (formatted.labels) {
					formatted.labels.push([
						e.zip.toString(),
						`${e.count.toString()} Families`,
					]);
				}
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

	private readonly capacityColorSettings = {
		used: 'rgba(63, 81, 181, 0.85)',
		available: 'rgba(102, 187, 106, 0.8)',
		overflow: 'rgba(255, 99, 132, 0.85)',
		border: '#ffffff',
	};

	public readonly capacityByDay$ = this.dateTimeSlots$.pipe(
		map((slots) => this.mapSlotsToCapacityCharts(slots)),
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
	): ChartData<'bar'>[] {
		const defaults = (
			label: string,
		): { datasets: { data: number[]; label: string }[] } => ({
			datasets: [{ data: [], ...this.colorSettings, label }],
		});

		const schedule = this.schedule.find((s) => s.year === this.year);
		if (!schedule) throw new Error('Unable to find schedule');

		const arr: {
			datasets: { data: number[]; label: string }[];
		}[] = [
			{ ...defaults(this.friendlyDay(schedule.days[0])) },
			{ ...defaults(this.friendlyDay(schedule.days[1])) },
			{ ...defaults(this.friendlyDay(schedule.days[2])) },
			{ ...defaults(this.friendlyDay(schedule.days[3])) },
		];

		// Update yearly. Last updated 2024
		const getDayIndex = (date: Date): number => {
			const day = date.getDate();
			return schedule.days.indexOf(day);
		};

		data.forEach((e) => {
			const dayIndex = getDayIndex(e.date);
			arr[dayIndex].datasets[0].data.push(e.count);
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
			(a: { date: Date; count: number }, b: { date: Date; count: number }) =>
				Number(a.date) - Number(b.date),
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
		const schedule = this.schedule.find((s) => s.year === this.year);
		if (!schedule) return [];

		const grouped = slots.reduce<Map<number, DateTimeSlot[]>>(
			(acc, slot) => {
				const date =
					slot.dateTime instanceof Date
						? slot.dateTime
						: (slot.dateTime as Timestamp).toDate();
				const day = date.getDate();
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
