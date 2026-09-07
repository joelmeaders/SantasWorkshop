import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResultsPage } from './results.page';
import { provideFirestoreWrapperMock } from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, Subject, defer, of, throwError } from 'rxjs';
import { SearchService } from '../search.service';
import type { RegistrationSearchIndex } from '@santashop/models';
import type { Observable } from 'rxjs';

describe('ResultsPage', () => {
	let component: ResultsPage;
	let fixture: ComponentFixture<ResultsPage>;
	const searchResults$ = new BehaviorSubject<Observable<
		RegistrationSearchIndex[]
	> | null>(null);
	const searchService = { searchResults$, reset: vi.fn() };

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [ResultsPage],
			providers: [
				provideFirestoreWrapperMock(),
				provideRouter([]),
				{ provide: SearchService, useValue: searchService },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(ResultsPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('keeps an entry refresh before the first render and cancels a replaced query', async () => {
		fixture.destroy();
		const pending = new Subject<RegistrationSearchIndex[]>();
		searchResults$.next(pending);
		fixture = TestBed.createComponent(ResultsPage);
		component = fixture.componentInstance;
		void component.ionViewWillEnter();
		await fixture.whenStable();
		expect(pending.observed).toBe(true);

		searchResults$.next(
			of([
				{
					firstName: 'Latest',
					lastName: 'Family',
					zip: '80201',
					emailAddress: 'latest@example.test',
					customerId: 'latest',
				},
			]),
		);
		await fixture.whenStable();
		expect(pending.observed).toBe(false);
		pending.next([]);
		expect(component.searchResults()).toEqual([
			expect.objectContaining({ customerId: 'latest' }),
		]);
		expect(fixture.nativeElement.textContent).toContain('Latest');
	});

	it('sorts the active results and resets search state on leave', async (): Promise<void> => {
		searchResults$.next(
			of([
				{
					firstName: 'Zoe',
					lastName: 'Anderson',
					zip: '80202',
					emailAddress: 'zoe@example.com',
					customerId: 'zoe',
				},
				{
					firstName: 'Amy',
					lastName: 'Anderson',
					zip: '80201',
					emailAddress: 'amy@example.com',
					customerId: 'amy',
				},
			]),
		);
		await component.ionViewWillEnter();
		await fixture.whenStable();
		expect(component.searchResults()).toEqual([
			expect.objectContaining({ firstName: 'Amy' }),
			expect.objectContaining({ firstName: 'Zoe' }),
		]);

		component.setSortType(component.sortEmail);
		component.reset();
		component.ionViewWillLeave();
		expect(searchService.reset).toHaveBeenCalledTimes(2);
	});

	it('sorts first-name and email selections by their displayed fields', (): void => {
		const records = [
			{
				firstName: 'Zoe',
				lastName: 'Able',
				zip: '80202',
				emailAddress: 'a@example.com',
				customerId: 'zoe',
			},
			{
				firstName: 'Amy',
				lastName: 'Zulu',
				zip: '80201',
				emailAddress: 'z@example.com',
				customerId: 'amy',
			},
		] as RegistrationSearchIndex[];

		expect([...records].sort(component.sortFirst)[0]?.firstName).toBe(
			'Amy',
		);
		expect([...records].sort(component.sortEmail)[0]?.emailAddress).toBe(
			'a@example.com',
		);
	});

	it('retries a failed search through Refresh results', async () => {
		let fail = true;
		const query = vi.fn(() =>
			fail ? throwError(() => new Error('offline')) : of([]),
		);
		searchResults$.next(defer(query));
		component.refresh();
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain(
			'Search results could not be loaded',
		);
		fail = false;
		component.refresh();
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain('No results found');
		expect(query).toHaveBeenCalledTimes(2);
	});
});
