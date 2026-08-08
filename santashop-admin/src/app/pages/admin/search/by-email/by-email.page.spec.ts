import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ByEmailPage } from './by-email.page';
import { provideFirestoreWrapperMock } from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';
import { SearchService } from '../search.service';

describe('ByEmailPage', () => {
	let component: ByEmailPage;
	let fixture: ComponentFixture<ByEmailPage>;
	const searchService = { searchByEmail: vi.fn() };

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [ByEmailPage],
			providers: [provideFirestoreWrapperMock(), provideRouter([]), { provide: SearchService, useValue: searchService }],
		}).compileComponents();

		fixture = TestBed.createComponent(ByEmailPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('searches the supplied email and clears the form', () => {
		component.form.setValue({ emailAddress: 'family@example.test' });
		component.search();
		component.reset();
		expect(searchService.searchByEmail).toHaveBeenCalledWith('family@example.test');
		expect(component.form.value.emailAddress).toBeNull();
	});
});
