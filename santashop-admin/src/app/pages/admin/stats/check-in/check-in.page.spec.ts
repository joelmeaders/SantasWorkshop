import {
	AdminReadRepository,
	type AdminReadCollection,
} from '../../../../shared/services/admin-read-repository.service';
import { beforeEach, describe, expect, it, type Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CheckInPage } from './check-in.page';
import {
	createFireRepoLiteMock,
	provideFirestoreWrapperMock,
	provideActivatedRouteMock,
	provideProgramYearMock,
} from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';
import { CheckInAggregatedStats } from '@santashop/models';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';

describe('CheckInPage', () => {
	let component: CheckInPage;
	let fixture: ComponentFixture<CheckInPage>;
	let statsCollection: Mocked<AdminReadCollection<CheckInAggregatedStats>>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [CheckInPage],
			providers: [
				provideFirestoreWrapperMock(),
				provideActivatedRouteMock(),
				provideProgramYearMock(2026),
				{
					provide: AdminReadRepository,
					useFactory: createFireRepoLiteMock,
				},
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(CheckInPage);
		component = fixture.componentInstance;
		statsCollection = TestBed.inject(AdminReadRepository).collection(
			'stats',
		) as Mocked<AdminReadCollection<CheckInAggregatedStats>>;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('keeps the empty state hidden while statistics are loading', async () => {
		const pending = new Subject<CheckInAggregatedStats | undefined>();
		statsCollection.read.mockReturnValue(pending);

		component.refresh();
		await fixture.whenStable();

		expect(
			fixture.nativeElement.querySelector('[data-checkin-stats-loading]'),
		).not.toBeNull();
		expect(fixture.nativeElement.textContent).not.toContain(
			'No check-ins have been recorded',
		);

		pending.next(undefined);
		await fixture.whenStable();

		expect(
			fixture.nativeElement.querySelector('[data-checkin-stats-loading]'),
		).toBeNull();
		expect(fixture.nativeElement.textContent).toContain(
			'No check-ins have been recorded',
		);
	});

	it('renders a recoverable error state when statistics cannot load', async () => {
		statsCollection.read.mockReturnValue(
			throwError(() => new Error('offline')),
		);

		component.refresh();
		await fixture.whenStable();

		expect(
			fixture.nativeElement.querySelector('[role="alert"]'),
		).not.toBeNull();
		expect(fixture.nativeElement.textContent).toContain('Try Again');
	});

	it('maps check-in statistics into totals, timestamps, and daily charts', async () => {
		statsCollection.read.mockReturnValue(
			of({
				lastUpdated: new Date('2026-12-10T18:00:00.000Z'),
				dateTimeCount: [
					{
						date: 11,
						hour: 13,
						customerCount: 3,
						childCount: 5,
						pregisteredCount: 2,
						modifiedCount: 1,
					},
					{
						date: 10,
						hour: 9,
						customerCount: 2,
						childCount: 1,
						pregisteredCount: 1,
						modifiedCount: 0,
					},
				],
			} as CheckInAggregatedStats),
		);
		component.refresh();

		await expect(firstValueFrom(component.hasData$)).resolves.toBe(true);
		await expect(firstValueFrom(component.totalCustomers$)).resolves.toBe(
			5,
		);
		await expect(firstValueFrom(component.totalChildren$)).resolves.toBe(6);
		await expect(
			firstValueFrom(component.totalPreregistered$),
		).resolves.toBe(3);
		await expect(
			firstValueFrom(component.onSiteRegistrations$),
		).resolves.toBe(2);
		await expect(
			firstValueFrom(component.totalModifiedRegistrations$),
		).resolves.toBe(1);
		await expect(
			firstValueFrom(component.checkinLastUpdated$),
		).resolves.toEqual(new Date('2026-12-10T18:00:00.000Z'));
		await expect(
			firstValueFrom(component.checkInsByDayHour$),
		).resolves.toMatchObject([
			{
				datasets: [
					{
						label: 'Dec 10, 2026',
						data: [2],
						dataSeriesLabels: ['9am'],
					},
				],
			},
			{
				datasets: [
					{
						label: 'Dec 11, 2026',
						data: [3],
						dataSeriesLabels: ['1pm'],
					},
				],
			},
		]);
	});

	it('renders local date keys and keeps legacy December buckets separate', async () => {
		statsCollection.read.mockReturnValue(
			of({
				lastUpdated: new Date('2026-09-05T23:14:00.000Z'),
				dateTimeCount: [
					{
						dateKey: '2026-09-05',
						date: 5,
						hour: 17,
						customerCount: 2,
						childCount: 2,
						pregisteredCount: 1,
						modifiedCount: 0,
					},
					{
						date: 5,
						hour: 17,
						customerCount: 1,
						childCount: 1,
						pregisteredCount: 1,
						modifiedCount: 0,
					},
				],
			} as CheckInAggregatedStats),
		);
		component.refresh();

		await expect(
			firstValueFrom(component.checkInsByDayHour$),
		).resolves.toMatchObject([
			{
				datasets: [
					{
						label: 'Sep 5, 2026',
						data: [2],
					},
				],
			},
			{
				datasets: [
					{
						label: 'Dec 5, 2026',
						data: [1],
					},
				],
			},
		]);
	});

	it('switches chart views and safely totals mixed chart values', async () => {
		await expect(firstValueFrom(component.viewButtonText$)).resolves.toBe(
			'View by Children',
		);
		component.switchView();
		await expect(firstValueFrom(component.viewButtonText$)).resolves.toBe(
			'View by Check-Ins',
		);
		expect(component.addValues()).toBe(0);
		expect(component.addValues([2, [3, 9], null, 4])).toBe(9);
	});
});
