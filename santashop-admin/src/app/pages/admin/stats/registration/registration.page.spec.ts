import {
	AdminReadRepository,
	type AdminReadCollection,
} from '../../../../shared/services/admin-read-repository.service';
import { beforeEach, describe, expect, it, type Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegistrationPage } from './registration.page';
import {
	createFireRepoLiteMock,
	provideFirestoreWrapperMock,
	provideActivatedRouteMock,
	provideProgramYearMock,
} from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';
import { SHOP_DAYS } from '@santashop/core/admin/firestore';
import {
	DateTimeSlot,
	RegistrationStats,
	RegistrationOperationalStats,
	ScheduleStats,
} from '@santashop/models';
import { of, Subject, throwError } from 'rxjs';

describe('RegistrationPage', () => {
	let component: RegistrationPage;
	let fixture: ComponentFixture<RegistrationPage>;
	let collection: Mocked<AdminReadCollection<RegistrationStats>>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [RegistrationPage],
			providers: [
				provideFirestoreWrapperMock(),
				provideActivatedRouteMock(),
				provideProgramYearMock(2026),
				{ provide: SHOP_DAYS, useValue: [10, 11, 12, 13] },
				{
					provide: AdminReadRepository,
					useFactory: createFireRepoLiteMock,
				},
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(RegistrationPage);
		component = fixture.componentInstance;
		collection = TestBed.inject(AdminReadRepository).collection(
			'stats',
		) as Mocked<AdminReadCollection<RegistrationStats>>;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('keeps legacy totals while marking new calculations and timestamps unavailable', async () => {
		collection.read.mockImplementation(
			(id: string) =>
				of(
					id.startsWith('registration-')
						? {
								completedRegistrations: 7,
								dateTimeCount: [],
								zipCodeCount: [],
							}
						: undefined,
				) as never,
		);
		collection.readMany.mockReturnValue(of([]) as never);
		component.year = 2024;
		component.refresh();
		await fixture.whenStable();
		expect(component.registrationCount()).toBe(7);
		expect(component.outcomeRows()).toEqual([]);
		expect(component.snapshotRows()).toEqual([]);
		expect(fixture.nativeElement.textContent).toContain(
			'Calculation time unavailable for this saved report.',
		);
		expect(fixture.nativeElement.textContent).toContain(
			'New outcome calculations are unavailable for this saved report.',
		);
		expect(fixture.nativeElement.textContent).not.toContain('0.0%');
	});

	it('shows explicit zero outcomes, unavailable rates, and dated snapshots without changing the registration count', async () => {
		const operational: RegistrationOperationalStats = {
			coverage: 'current-records',
			registrationRecords: 5,
			submittedRegistrations: 0,
			draftRegistrations: 5,
			cancelledRegistrations: 0,
			recordedCancellationEvents: 0,
			checkedInRegistrations: 0,
			pastAppointmentRegistrations: 0,
			attendedPastAppointments: 0,
			unconfirmedPastAppointments: 0,
			attendanceStatusUnavailable: 0,
			missingAppointmentRegistrations: 0,
			invalidSubmissionDates: 0,
			completionRate: 0,
		};
		const calculatedAt = new Date('2026-09-10T06:00:00Z');
		collection.read.mockImplementation(
			(id: string) =>
				of(
					id.startsWith('registration-')
						? {
								completedRegistrations: 3,
								dateTimeCount: [],
								zipCodeCount: [],
								calculatedAt,
								operational,
								dailySnapshots: [
									{
										...operational,
										dateKey: '2026-09-10',
										calculatedAt,
									},
								],
							}
						: { dateTimeCounts: [] },
				) as never,
		);
		collection.readMany.mockReturnValue(of([]) as never);
		component.refresh();
		await fixture.whenStable();
		expect(component.registrationCount()).toBe(3);
		expect(component.outcomeRows()).toContainEqual([
			'Current cancelled registrations',
			0,
		]);
		expect(component.outcomeRows()).toContainEqual([
			'Completion rate',
			'0.0%',
		]);
		expect(component.outcomeRows()).toContainEqual([
			'Attendance rate for past appointments',
			undefined,
		]);
		expect(component.snapshotRows()[0]).toEqual([
			'2026-09-10',
			'2026-09-10T06:00:00.000Z',
			5,
			0,
			5,
			0,
			0,
			'0.0%',
		]);
		expect(component.appointmentExportContext()).toContainEqual([
			'Calculated at',
			undefined,
		]);
		expect(fixture.nativeElement.textContent).toContain('Unavailable');
	});

	it('includes every ZIP code in the pie, table and export totals', async () => {
		const zipCodeCount = [6, 5, 4, 3, 2, 1].map((count, index) => ({
			zip: 80200 + index,
			count,
			childCount: count * 2,
		}));
		collection.read.mockImplementation(
			(id: string) =>
				of(
					id.startsWith('registration-')
						? {
								completedRegistrations: 21,
								dateTimeCount: [],
								zipCodeCount,
							}
						: undefined,
				) as never,
		);
		collection.readMany.mockReturnValue(of([]) as never);
		component.refresh();
		await fixture.whenStable();
		expect(component.topTenZipCodesCountData().labels).toContainEqual([
			'Other',
			'3 Families',
		]);
		expect(component.topTenZipCodesCountData().datasets[0].data).toEqual([
			6, 5, 4, 3, 3,
		]);
		expect(component.zipRows()).toHaveLength(6);
		expect(component.zipTotals()).toEqual(['Total', 21, 42]);
		const tables = Array.from(
			fixture.nativeElement.querySelectorAll('table'),
		) as HTMLTableElement[];
		const zipTable = tables.find(
			(table) =>
				table.caption?.textContent?.trim() === 'Registration ZIP codes',
		);
		expect(zipTable?.querySelectorAll('tbody tr')).toHaveLength(6);
		expect(zipTable?.querySelector('tfoot')?.textContent).toContain('21');
	});

	it('derives registration totals, demographic charts, and zip-code charts', async () => {
		const registrationStats: RegistrationStats = {
			completedRegistrations: 3,
			dateTimeCount: [
				{
					dateTime: new Date('2026-12-11T18:00:00.000Z'),
					count: 2,
					childCount: 4,
					stats: {
						infants: {
							total: 1,
							age02: 1,
							age35: 0,
							age68: 0,
							age911: 0,
						},
						girls: {
							total: 2,
							age02: 0,
							age35: 1,
							age68: 1,
							age911: 0,
						},
						boys: {
							total: 1,
							age02: 0,
							age35: 0,
							age68: 1,
							age911: 0,
						},
					},
				},
				{
					dateTime: new Date('2026-12-10T18:00:00.000Z'),
					count: 1,
					childCount: 2,
					stats: {
						infants: {
							total: 0,
							age02: 0,
							age35: 0,
							age68: 0,
							age911: 0,
						},
						girls: {
							total: 1,
							age02: 0,
							age35: 0,
							age68: 0,
							age911: 1,
						},
						boys: {
							total: 1,
							age02: 0,
							age35: 1,
							age68: 0,
							age911: 0,
						},
					},
				},
			],
			zipCodeCount: [
				{ zip: 80205, count: 3, childCount: 4 },
				{ zip: 80219, count: 8, childCount: 9 },
				{ zip: 80204, count: 5, childCount: 5 },
			],
		};
		const scheduleStats: ScheduleStats = {
			dateTimeCounts: [
				{ dateTime: new Date('2026-12-10T18:00:00.000Z'), count: 1 },
				{ dateTime: new Date('2026-12-11T18:00:00.000Z'), count: 2 },
			],
		};
		collection.read.mockImplementation(
			(id: string) =>
				of(
					id.startsWith('registration-')
						? registrationStats
						: scheduleStats,
				) as never,
		);
		collection.readMany.mockReturnValue(
			of([
				{
					id: 'slot-1',
					dateTime: new Date('2026-12-10T18:00:00.000Z'),
					maxSlots: 10,
					slotsReserved: 12,
					enabled: true,
				},
				{
					id: 'slot-2',
					dateTime: new Date('2026-12-11T18:00:00.000Z'),
					maxSlots: 20,
					slotsReserved: 5,
					enabled: true,
				},
			] as DateTimeSlot[]) as never,
		);

		component.refresh();
		await fixture.whenStable();
		expect(component.registrationCount()).toBe(3);
		expect(component.registrationCountBySchedule()).toBe(3);
		expect(component.childCount()).toBe(6);
		expect(component.childrenPerCustomer()).toBe(2);
		expect(component.girlBoyInfantCounts()).toEqual([3, 2, 1]);
		expect(component.statsNull()).toBe(false);
		const familiesByDay = component.familiesBySlotsChartData();
		expect(familiesByDay).toHaveLength(4);
		expect(familiesByDay.slice(0, 2)).toMatchObject([
			{ datasets: [{ label: '10th', data: [1] }] },
			{ datasets: [{ label: '11th', data: [2] }] },
		]);
		expect(component.topTenZipCodesCountData()).toMatchObject({
			labels: [
				['80219', '8 Families'],
				['80204', '5 Families'],
				['80205', '3 Families'],
			],
			datasets: [{ data: [8, 5, 3] }],
		});
	});

	it('maps capacity including overflow, remaining space, and mixed chart totals', async () => {
		collection.read.mockReturnValue(of(undefined));
		collection.readMany.mockReturnValue(
			of([
				{
					id: 'overflow',
					dateTime: new Date('2026-12-10T18:00:00.000Z'),
					maxSlots: 10,
					slotsReserved: 12,
					enabled: true,
				},
				{
					id: 'available',
					dateTime: new Date('2026-12-11T18:00:00.000Z'),
					maxSlots: 20,
					slotsReserved: 5,
					enabled: true,
				},
			] as DateTimeSlot[]) as never,
		);

		component.refresh();
		await fixture.whenStable();
		expect(component.hasScheduleData()).toBe(true);
		expect(fixture.nativeElement.textContent).toContain('Capacity by Day');
		expect(fixture.nativeElement.textContent).not.toContain(
			'No schedule data for this year',
		);
		const capacityByDay = component.capacityByDay();
		expect(capacityByDay).toHaveLength(4);
		expect(capacityByDay.slice(0, 2)).toMatchObject([
			{
				label: '10th',
				used: 12,
				total: 10,
				remaining: 0,
				overflow: 2,
				chartData: {
					labels: ['Used', 'Overflow'],
					datasets: [{ data: [10, 2] }],
				},
			},
			{
				label: '11th',
				used: 5,
				total: 20,
				remaining: 15,
				overflow: 0,
				chartData: {
					labels: ['Used', 'Remaining'],
					datasets: [{ data: [5, 15] }],
				},
			},
		]);
		expect(component.getTotalCount([2, [3, 7], null, 4])).toBe(9);
	});

	it('refreshes all report inputs once per refresh, retries errors, and loads the selected year', async () => {
		collection.read.mockReturnValue(throwError(() => new Error('offline')));
		component.refresh();
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain(
			'Report could not be loaded',
		);
		collection.read.mockClear().mockReturnValue(of(undefined));
		collection.readMany.mockClear().mockReturnValue(of([]) as never);
		component.year = 2025;
		fixture.nativeElement.querySelector('ion-content ion-button').click();
		await fixture.whenStable();
		expect(collection.read).toHaveBeenCalledTimes(2);
		expect(collection.read).toHaveBeenCalledWith('registration-2025');
		expect(collection.read).toHaveBeenCalledWith('schedule-2025');
		expect(collection.readMany).toHaveBeenCalledTimes(1);
		expect(fixture.nativeElement.textContent).toContain(
			'No schedule data for this year',
		);
	});
	it('uses nightly registration totals when the seasonal schedule aggregate is absent', async () => {
		const dateTime = new Date('2026-12-10T18:00:00.000Z');
		collection.read.mockImplementation(
			(id: string) =>
				of(
					id.startsWith('registration-')
						? {
								completedRegistrations: 4,
								dateTimeCount: [
									{ dateTime, count: 4, childCount: 4 },
								],
								zipCodeCount: [],
							}
						: undefined,
				) as never,
		);
		collection.readMany.mockReturnValue(
			of([
				{ dateTime, maxSlots: 20, slotsReserved: 0, enabled: true },
			] as DateTimeSlot[]) as never,
		);
		component.refresh();
		await fixture.whenStable();
		expect(component.registrationCountBySchedule()).toBe(4);
		expect(component.familiesBySlots()).toEqual([
			{ date: dateTime, count: 4 },
		]);
		expect(fixture.nativeElement.textContent).toContain('Capacity by Day');
	});
	it('applies chart colors when the first report arrives synchronously', () => {
		collection.read.mockImplementation(
			(id: string) =>
				of(
					id.startsWith('registration-')
						? {
								completedRegistrations: 1,
								dateTimeCount: [],
								zipCodeCount: [
									{ zip: 80219, count: 1, childCount: 1 },
								],
							}
						: undefined,
				) as never,
		);
		collection.readMany.mockReturnValue(
			of([
				{
					dateTime: new Date('2026-12-10T18:00:00.000Z'),
					maxSlots: 20,
					slotsReserved: 5,
					enabled: true,
				},
			]) as never,
		);
		fixture.destroy();
		fixture = TestBed.createComponent(RegistrationPage);
		component = fixture.componentInstance;
		expect(component.topTenZipCodesCountData().datasets[0]).toMatchObject(
			component.colorSettings,
		);
		expect(
			component.capacityByDay()[0].chartData.datasets[0].backgroundColor,
		).toEqual(['rgba(63, 81, 181, 0.85)', 'rgba(102, 187, 106, 0.8)']);
	});

	it('cancels an old report on refresh and releases pending reads on destruction', () => {
		const oldReport = new Subject<RegistrationStats | undefined>();
		collection.read
			.mockReturnValue(of(undefined))
			.mockReturnValueOnce(oldReport.asObservable());
		collection.readMany.mockReturnValue(of([]) as never);
		component.refresh();
		expect(component.state().status).toBe('loading');
		expect(oldReport.observed).toBe(true);
		component.refresh();
		expect(oldReport.observed).toBe(false);
		oldReport.next({
			completedRegistrations: 99,
			dateTimeCount: [],
			zipCodeCount: [],
		});
		oldReport.complete();
		expect(component.registrationCount()).toBe(0);
		const pendingReport = new Subject<RegistrationStats | undefined>();
		collection.read.mockReturnValueOnce(pendingReport.asObservable());
		component.refresh();
		expect(pendingReport.observed).toBe(true);
		fixture.destroy();
		expect(pendingReport.observed).toBe(false);
	});
});
