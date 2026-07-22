import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {
	provideTranslateServiceMock,
	provideAuthMock,
	provideFirestoreMock,
	provideFunctionsMock,
	provideStorageMock,
} from '../../../../test-helpers';
import { PreRegistrationMenuComponent } from './pre-registration-menu.component';

describe('PreRegistrationMenuComponent', () => {
	let component: PreRegistrationMenuComponent;
	let fixture: ComponentFixture<PreRegistrationMenuComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [PreRegistrationMenuComponent],
			providers: [
				provideFirestoreMock(),
				provideAuthMock(),
				provideFunctionsMock(),
				provideStorageMock(),
				provideTranslateServiceMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(PreRegistrationMenuComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
