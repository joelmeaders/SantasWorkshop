import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { DuplicatePage } from './duplicate.page';
import {
	provideFirestoreWrapperMock,
	provideAnalyticsMock,
} from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('DuplicatePage', () => {
	let component: DuplicatePage;
	let fixture: ComponentFixture<DuplicatePage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [DuplicatePage],
			providers: [
				provideFirestoreWrapperMock(),
				provideAnalyticsMock(),
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(DuplicatePage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
