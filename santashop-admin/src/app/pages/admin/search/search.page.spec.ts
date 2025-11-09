import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { SearchPage } from './search.page';
import { provideActivatedRouteMock } from '../../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('SearchPage', () => {
	let component: SearchPage;
	let fixture: ComponentFixture<SearchPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [SearchPage],
			providers: [provideActivatedRouteMock(), provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(SearchPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
