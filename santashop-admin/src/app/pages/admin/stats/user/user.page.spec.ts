import {
	AdminReadRepository,
	type AdminReadCollection,
} from '../../../../shared/services/admin-read-repository.service';
import { beforeEach, describe, expect, it, type Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserPage } from './user.page';
import {
	createFireRepoLiteMock,
	provideFirestoreWrapperMock,
	provideActivatedRouteMock,
	provideProgramYearMock,
	requireDefined,
} from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';
import { UserStats } from '@santashop/models';
import { of, throwError } from 'rxjs';

describe('UserPage', () => {
	let component: UserPage;
	let fixture: ComponentFixture<UserPage>;
	let statsCollection: Mocked<AdminReadCollection<UserStats>>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [UserPage],
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

		fixture = TestBed.createComponent(UserPage);
		component = fixture.componentInstance;
		statsCollection = TestBed.inject(AdminReadRepository).collection(
			'stats',
		) as Mocked<AdminReadCollection<UserStats>>;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('labels the legacy population and clears all tables when the next year has no report', async () => {
		statsCollection.read.mockReturnValue(
			of({
				totalUsers: 2,
				referrerCount: [{ referrer: 'School', count: 2 }],
				zipCodeCount: [{ zip: '80219', count: 2 }],
			}),
		);
		component.refresh();
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain(
			'Older totals may leave out shoppers',
		);
		expect(fixture.nativeElement.textContent).toContain(
			'Update time not saved',
		);
		expect(component.referralRows()).toEqual([['School', 2]]);
		statsCollection.read.mockReturnValue(of(undefined));
		component.year = 2025;
		component.refresh();
		await fixture.whenStable();
		expect(component.referralRows()).toEqual([]);
		expect(component.zipRows()).toEqual([]);
		expect(component.userRecord()).toBeUndefined();
	});

	it('retains all referral and ZIP rows beyond chart limits and shows observed creation-day coverage', async () => {
		const data: UserStats = {
			population: 'all-users',
			totalUsers: 11,
			referrerCount: Array.from({ length: 11 }, (_, index) => ({
				referrer: index === 0 ? 'Unknown' : `School ${index}`,
				count: 1,
			})),
			zipCodeCount: Array.from({ length: 11 }, (_, index) => ({
				zip: String(80200 + index),
				count: 1,
			})),
			dailySignups: [{ dateKey: '2026-09-09', count: 20 }],
			signupDatesUnavailable: 0,
			signupDatesOutsideProgramYear: 0,
		};
		statsCollection.read.mockReturnValue(of(data));
		component.refresh();
		await fixture.whenStable();
		expect(component.referrers()).toHaveLength(10);
		expect(component.zipCodes()).toHaveLength(10);
		expect(component.referralRows()).toHaveLength(11);
		expect(component.zipRows()).toHaveLength(11);
		expect(component.referralTotal()).toEqual(['Total', 11]);
		expect(component.zipTotal()).toEqual(['Total', 11]);
		expect(component.signupRows()).toEqual([['2026-09-09', 20]]);
		expect(component.signupExportContext()).toContainEqual([
			'Includes',
			'Highest saved shopper count for each profile creation day, including profiles later removed',
		]);
		expect(component.signupExportContext()).toContainEqual([
			'Shopper profiles with missing creation dates',
			0,
		]);
		expect(component.signupExportContext()).toContainEqual([
			'Shopper profiles created in other years',
			0,
		]);
		expect(component.signupExportContext().flat()).not.toContain(
			'All saved shopper profiles',
		);
		expect(fixture.nativeElement.textContent).toContain(
			'they may be higher than the total above',
		);
	});

	it('sorts and limits referrer and zip-code chart datasets', async () => {
		statsCollection.read.mockReturnValue(
			of({
				referrerCount: [
					{ referrer: 'School', count: 3 },
					{ referrer: 'Friend', count: 8 },
					{ referrer: 'Church', count: 5 },
				],
				zipCodeCount: [
					{ zip: '80205', count: 2 },
					{ zip: '80219', count: 7 },
					{ zip: '80204', count: 4 },
				],
			} as UserStats),
		);

		component.refresh();
		await fixture.whenStable();
		await fixture.whenStable();
		expect(
			component.referrers().map(({ label, data }) => ({ label, data })),
		).toEqual([
			{ label: 'Friend', data: [8] },
			{ label: 'Church', data: [5] },
			{ label: 'School', data: [3] },
		]);
		expect(
			component.zipCodes().map(({ label, data }) => ({ label, data })),
		).toEqual([
			{ label: '80219', data: [7] },
			{ label: '80204', data: [4] },
			{ label: '80205', data: [2] },
		]);
	});

	it('formats labels through both chart data-label formatters', () => {
		const labelContext = {
			dataset: { data: [4], label: 'Friend' },
			chart: { data: { labels: ['80219'] } },
			dataIndex: 0,
		};
		const referrerFormatter = requireDefined(component.barChartOptions)
			.plugins?.datalabels?.formatter as (
			value: number,
			context: typeof labelContext,
		) => string;
		const zipFormatter = requireDefined(component.zipCodeChartOptions)
			.plugins?.datalabels?.formatter as (
			value: number,
			context: typeof labelContext,
		) => string;

		expect(referrerFormatter(4, labelContext)).toBe('4 - Friend');
		expect(zipFormatter(4, labelContext)).toBe('4 Shoppers - Friend');
	});

	it('refreshes a shared report once, clears missing data, and recovers after a failed request', async () => {
		statsCollection.read.mockReturnValue(
			throwError(() => new Error('offline')),
		);
		component.refresh();
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain(
			'Report could not be loaded',
		);
		statsCollection.read.mockClear().mockReturnValue(
			of({
				referrerCount: [],
				zipCodeCount: [],
			} as unknown as UserStats),
		);
		fixture.nativeElement.querySelector('ion-content ion-button').click();
		await fixture.whenStable();
		expect(statsCollection.read).toHaveBeenCalledTimes(1);
		expect(fixture.nativeElement.querySelectorAll('canvas')).toHaveLength(
			2,
		);
		statsCollection.read.mockReturnValue(of(undefined));
		component.refresh();
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain(
			'No shopper data for this year',
		);
		expect(fixture.nativeElement.querySelectorAll('canvas')).toHaveLength(
			0,
		);
	});
});
