import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResultsPage } from './results.page';
import { provideFirestoreWrapperMock } from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { SearchService } from '../search.service';
import type { RegistrationSearchIndex } from '@santashop/models';
import type { Observable } from 'rxjs';

describe('ResultsPage', () => {
	let component: ResultsPage;
	let fixture: ComponentFixture<ResultsPage>;
	const searchResults$ = new BehaviorSubject<
		Observable<RegistrationSearchIndex[]> | null
	>(null);
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
			{ firstName: 'Zoe', lastName: 'Anderson', zip: '80202', emailAddress: 'zoe@example.com', customerId: 'zoe' },
			{ firstName: 'Amy', lastName: 'Anderson', zip: '80201', emailAddress: 'amy@example.com', customerId: 'amy' },
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

	it('sorts legacy numeric zip values without throwing', (): void => {
		const numericZip = {
			firstName: 'Amy',
			lastName: 'Anderson',
			zip: 80201,
			emailAddress: 'amy@example.com',
			customerId: 'numeric',
		} as unknown as RegistrationSearchIndex;
		const stringZip = {
			...numericZip,
			zip: '80202',
			customerId: 'string',
		};

		expect(component.sortLast(numericZip, stringZip)).toBeLessThan(0);
	});

	it('sorts first-name and email selections by their displayed fields', (): void => {
		const records = [
			{ firstName: 'Zoe', lastName: 'Able', zip: '80202', emailAddress: 'a@example.com', customerId: 'zoe' },
			{ firstName: 'Amy', lastName: 'Zulu', zip: '80201', emailAddress: 'z@example.com', customerId: 'amy' },
		] as RegistrationSearchIndex[];

		expect([...records].sort(component.sortFirst)[0]?.firstName).toBe('Amy');
		expect([...records].sort(component.sortEmail)[0]?.emailAddress).toBe('a@example.com');
	});
});
