import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ByCodePage } from './by-code.page';
import { provideFirestoreWrapperMock } from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';
import { SearchService } from '../search.service';

describe('ByCodePage', () => {
	let component: ByCodePage;
	let fixture: ComponentFixture<ByCodePage>;
	const searchService = { searchByCode: vi.fn() };

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [ByCodePage],
			providers: [provideFirestoreWrapperMock(), provideRouter([]), { provide: SearchService, useValue: searchService }],
		}).compileComponents();

		fixture = TestBed.createComponent(ByCodePage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('searches the supplied code and clears the form', () => {
		component.form.setValue({ code: 'AB12CD3' });
		component.search();
		component.reset();
		expect(searchService.searchByCode).toHaveBeenCalledWith('AB12CD3');
		expect(component.form.value.code).toBeNull();
	});
});
