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
import { FireRepoLite, IFireRepoCollection } from '@santashop/core';
import { UserStats } from '@santashop/models';
import { firstValueFrom, of } from 'rxjs';

describe('UserPage', () => {
	let component: UserPage;
	let fixture: ComponentFixture<UserPage>;
	let statsCollection: Mocked<IFireRepoCollection<UserStats>>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [UserPage],
			providers: [
				provideFirestoreWrapperMock(),
				provideActivatedRouteMock(),
				provideProgramYearMock(2026),
				{ provide: FireRepoLite, useFactory: createFireRepoLiteMock },
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(UserPage);
		component = fixture.componentInstance;
		statsCollection = TestBed.inject(FireRepoLite).collection(
			'stats',
		) as Mocked<IFireRepoCollection<UserStats>>;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
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

		await expect(firstValueFrom(component.referrers$)).resolves.toEqual([
			{ label: 'Friend', data: [8] },
			{ label: 'Church', data: [5] },
			{ label: 'School', data: [3] },
		]);
		await expect(firstValueFrom(component.zipCodes$)).resolves.toEqual([
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
		const referrerFormatter = requireDefined(component.barChartOptions).plugins?.datalabels
			?.formatter as (value: number, context: typeof labelContext) => string;
		const zipFormatter = requireDefined(component.zipCodeChartOptions).plugins?.datalabels
			?.formatter as (value: number, context: typeof labelContext) => string;

		expect(referrerFormatter(4, labelContext)).toBe('4 - Friend');
		expect(zipFormatter(4, labelContext)).toBe('4 Families - Friend');
	});
});
