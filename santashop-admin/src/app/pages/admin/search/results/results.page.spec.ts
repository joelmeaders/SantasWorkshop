import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ResultsPage } from './results.page';
import { provideFirestoreWrapperMock } from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('ResultsPage', () => {
	let component: ResultsPage;
	let fixture: ComponentFixture<ResultsPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ResultsPage],
			providers: [provideFirestoreWrapperMock(), provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(ResultsPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
