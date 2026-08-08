import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ByNamePage } from './by-name.page';
import { provideFirestoreWrapperMock } from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';
import { SearchService } from '../search.service';

describe('ByNamePage', () => {
	let component: ByNamePage;
	let fixture: ComponentFixture<ByNamePage>;
	const searchService = { searchByLastNameZip: vi.fn() };

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [ByNamePage],
			providers: [provideFirestoreWrapperMock(), provideRouter([]), { provide: SearchService, useValue: searchService }],
		}).compileComponents();

		fixture = TestBed.createComponent(ByNamePage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('searches by last name and zip, then clears the form', () => {
		component.form.setValue({ lastName: 'Smith', zipCode: '80202' });
		component.search();
		component.reset();
		expect(searchService.searchByLastNameZip).toHaveBeenCalledWith('Smith', '80202');
		expect(component.form.value.lastName).toBeNull();
	});
});
