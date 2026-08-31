import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchPage } from './search.page';
import { provideActivatedRouteMock } from '../../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('SearchPage', () => {
	let component: SearchPage;
	let fixture: ComponentFixture<SearchPage>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [SearchPage],
			providers: [provideActivatedRouteMock(), provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(SearchPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
