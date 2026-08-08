import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResultsPage } from './results.page';
import { provideFirestoreWrapperMock } from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { SearchService } from '../search.service';

describe('ResultsPage', () => {
	let component: ResultsPage;
	let fixture: ComponentFixture<ResultsPage>;
	const searchResults$ = new BehaviorSubject<any>(null);
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

	it('sorts the active results and resets search state on leave', async (): Promise<void> => {
		searchResults$.next(of([
			{ firstName: 'Zoe', lastName: 'Anderson', zip: '80202', emailAddress: 'zoe@example.com' },
			{ firstName: 'Amy', lastName: 'Anderson', zip: '80201', emailAddress: 'amy@example.com' },
		]));
		await component.ionViewWillEnter();
		await expect(firstValueFrom(component.searchResults$)).resolves.toEqual([
			expect.objectContaining({ firstName: 'Amy' }), expect.objectContaining({ firstName: 'Zoe' }),
		]);

		component.setSortType(component.sortEmail);
		component.reset();
		component.ionViewWillLeave();
		expect(searchService.reset).toHaveBeenCalledTimes(2);
	});
});
