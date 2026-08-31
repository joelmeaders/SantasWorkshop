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
import { FireRepoLite, IFireRepoCollection, SHOP_DAYS } from '@santashop/core';
import {
	DateTimeSlot,
	RegistrationStats,
	ScheduleStats,
} from '@santashop/models';
import { firstValueFrom, of } from 'rxjs';

describe('RegistrationPage', () => {
	let component: RegistrationPage;
	let fixture: ComponentFixture<RegistrationPage>;
	let collection: Mocked<IFireRepoCollection<RegistrationStats>>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [RegistrationPage],
			providers: [
				provideFirestoreWrapperMock(),
				provideActivatedRouteMock(),
				provideProgramYearMock(2026),
				{ provide: SHOP_DAYS, useValue: [10, 11, 12, 13] },
				{ provide: FireRepoLite, useFactory: createFireRepoLiteMock },
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(RegistrationPage);
		component = fixture.componentInstance;
		collection = TestBed.inject(FireRepoLite).collection(
			'stats',
		) as Mocked<IFireRepoCollection<RegistrationStats>>;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
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
						infants: { total: 1, age02: 1, age35: 0, age68: 0, age911: 0 },
						girls: { total: 2, age02: 0, age35: 1, age68: 1, age911: 0 },
						boys: { total: 1, age02: 0, age35: 0, age68: 1, age911: 0 },
					},
				},
				{
					dateTime: new Date('2026-12-10T18:00:00.000Z'),
					count: 1,
					childCount: 2,
					stats: {
						infants: { total: 0, age02: 0, age35: 0, age68: 0, age911: 0 },
						girls: { total: 1, age02: 0, age35: 0, age68: 0, age911: 1 },
						boys: { total: 1, age02: 0, age35: 1, age68: 0, age911: 0 },
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
		collection.read.mockImplementation((id: string) =>
			of(id.startsWith('registration-') ? registrationStats : scheduleStats) as never,
		);
		collection.readMany
			.mockReturnValue(
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

		await expect(firstValueFrom(component.registrationCount$)).resolves.toBe(3);
		await expect(firstValueFrom(component.registrationCountBySchedule$)).resolves.toBe(3);
		await expect(firstValueFrom(component.childCount$)).resolves.toBe(6);
		await expect(firstValueFrom(component.childrenPerCustomer$)).resolves.toBe(2);
		await expect(firstValueFrom(component.girlBoyInfantCounts$)).resolves.toEqual([3, 2, 1]);
		await expect(firstValueFrom(component.statsNull$)).resolves.toBe(false);
		const familiesByDay = await firstValueFrom(component.familiesBySlotsChartData$);
		expect(familiesByDay).toHaveLength(4);
		expect(familiesByDay.slice(0, 2)).toMatchObject([
			{ datasets: [{ label: '10th', data: [1] }] },
			{ datasets: [{ label: '11th', data: [2] }] },
		]);
		await expect(firstValueFrom(component.topTenZipCodesCountData$)).resolves.toMatchObject({
			labels: [['80219', '8 Families'], ['80204', '5 Families'], ['80205', '3 Families']],
			datasets: [{ data: [8, 5, 3] }],
		});
	});

	it('maps capacity including overflow, remaining space, and mixed chart totals', async () => {
		collection.read.mockReturnValue(of(undefined));
		collection.readMany
			.mockReturnValue(
				of([
					{
						id: 'overflow', dateTime: new Date('2026-12-10T18:00:00.000Z'),
						maxSlots: 10, slotsReserved: 12, enabled: true,
					},
					{
						id: 'available', dateTime: new Date('2026-12-11T18:00:00.000Z'),
						maxSlots: 20, slotsReserved: 5, enabled: true,
					},
				] as DateTimeSlot[]) as never,
			);

		const capacityByDay = await firstValueFrom(component.capacityByDay$);
		expect(capacityByDay).toHaveLength(4);
		expect(capacityByDay.slice(0, 2)).toMatchObject([
			{ label: '10th', used: 12, total: 10, remaining: 0, overflow: 2, chartData: { labels: ['Used', 'Overflow'], datasets: [{ data: [10, 2] }] } },
			{ label: '11th', used: 5, total: 20, remaining: 15, overflow: 0, chartData: { labels: ['Used', 'Remaining'], datasets: [{ data: [5, 15] }] } },
		]);
		expect(component.getTotalCount([2, [3, 7], null, 4])).toBe(9);
	});
});
