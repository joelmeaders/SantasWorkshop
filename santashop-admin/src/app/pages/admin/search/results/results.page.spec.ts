import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import type { RegistrationSearchIndex } from '@santashop/models';
import { ResultsPage } from './results.page';
import { SearchService } from '../search.service';
import {
	AdminReadRepository,
	type AdminReadCollection,
} from '../../../../shared/services/admin-read-repository.service';

const records: RegistrationSearchIndex[] = [
	{
		firstName: 'Zoe',
		lastName: 'Able',
		zip: '80202',
		emailAddress: 'a@example.test',
		customerId: 'zoe',
	},
	{
		firstName: 'Amy',
		lastName: 'Zulu',
		zip: '80201',
		emailAddress: 'z@example.test',
		customerId: 'amy',
	},
];

describe('ResultsPage with SearchService', () => {
	let fixture: ComponentFixture<ResultsPage>;
	let service: SearchService;
	let reads: ReturnType<
		typeof vi.fn<AdminReadCollection<RegistrationSearchIndex>['readMany']>
	>;
	beforeEach(async () => {
		reads = vi
			.fn<AdminReadCollection<RegistrationSearchIndex>['readMany']>()
			.mockReturnValue(of(records));
		await TestBed.configureTestingModule({
			imports: [ResultsPage],
			providers: [
				provideRouter([]),
				{
					provide: AdminReadRepository,
					useValue: { collection: () => ({ readMany: reads }) },
				},
			],
		}).compileComponents();
		service = TestBed.inject(SearchService);
		fixture = TestBed.createComponent(ResultsPage);
		await fixture.whenStable();
	});

	it('renders no query separately from an empty result', async () => {
		expect(fixture.nativeElement.textContent).toContain(
			'No search was entered',
		);
		expect(fixture.nativeElement.textContent).not.toContain(
			'No results found',
		);
		reads.mockReturnValue(of([]));
		service.searchByCode('missing');
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain('No results found');
		expect(fixture.nativeElement.textContent).not.toContain(
			'No search was entered',
		);
	});

	it('cancels a replaced query and renders only its replacement', async () => {
		const pending = new Subject<RegistrationSearchIndex[]>();
		reads.mockReturnValueOnce(pending);
		service.searchByCode('slow');
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain(
			'Searching, please wait',
		);
		service.searchByCode('new');
		await fixture.whenStable();
		expect(pending.observed).toBe(false);
		pending.next([]);
		expect(fixture.componentInstance.searchResults()).toEqual(records);
		expect(fixture.nativeElement.textContent).toContain('Zoe');
	});

	it('sorts locally without refetching or mutating shared results', async () => {
		service.searchByCode('family');
		const page = fixture.componentInstance;
		page.setSortType(page.sortFirst);
		await fixture.whenStable();
		expect(page.searchResults()?.[0].customerId).toBe('amy');
		page.setSortType(page.sortEmail);
		expect(page.searchResults()?.[0].customerId).toBe('zoe');
		page.setSortType(page.sortLast);
		expect(page.searchResults()?.[0].customerId).toBe('zoe');
		expect(records[0].customerId).toBe('zoe');
		expect(reads).toHaveBeenCalledOnce();
	});

	it('retries a failed read using the visible refresh action', async () => {
		reads
			.mockReturnValueOnce(throwError(() => new Error('offline')))
			.mockReturnValueOnce(of([]));
		service.searchByCode('retry');
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain(
			'Search results could not be loaded',
		);
		const button = [
			...(fixture.nativeElement.querySelectorAll(
				'ion-button',
			) as NodeListOf<HTMLIonButtonElement>),
		].find((element) => element.textContent?.includes('Refresh results'));
		button?.click();
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain('No results found');
		expect(reads).toHaveBeenCalledTimes(2);
	});

	it('clears on leaving an Ionic cached view and handles the next entry once', async () => {
		service.searchByCode('first');
		fixture.componentInstance.ionViewWillLeave();
		await fixture.whenStable();
		expect(fixture.componentInstance.state().status).toBe('idle');
		service.searchByEmail('next@example.test');
		await fixture.whenStable();
		expect(fixture.componentInstance.state().status).toBe('ready');
		expect(reads).toHaveBeenCalledTimes(2);
	});
});
