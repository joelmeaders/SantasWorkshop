import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SearchPage } from './search.page';

describe('SearchPage', () => {
	let component: SearchPage;
	let fixture: ComponentFixture<SearchPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [SearchPage],
		}).compileComponents();

		fixture = TestBed.createComponent(SearchPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
