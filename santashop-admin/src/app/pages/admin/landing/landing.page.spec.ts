import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { LandingPage } from './landing.page';
import {
	provideAuthMock,
	provideFunctionsMock,
	provideFirestoreWrapperMock,
} from '../../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('LandingPage', () => {
	let component: LandingPage;
	let fixture: ComponentFixture<LandingPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [LandingPage],
			providers: [
				provideAuthMock(),
				provideFunctionsMock(),
				provideFirestoreWrapperMock(),
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(LandingPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
