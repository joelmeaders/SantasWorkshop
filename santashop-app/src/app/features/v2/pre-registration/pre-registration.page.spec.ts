import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {
	provideActivatedRouteMock,
	provideAuthMock,
	provideFirestoreMock,
	provideFunctionsMock,
	provideStorageMock,
	createPopoverControllerMock,
	provideTranslateServiceMock,
} from '../../../../test-helpers';
import { PopoverController } from '@ionic/angular/standalone';

import { PreRegistrationPage } from './pre-registration.page';

describe('PreRegistrationPage', () => {
	let component: PreRegistrationPage;
	let fixture: ComponentFixture<PreRegistrationPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [PreRegistrationPage],
			providers: [
				provideFirestoreMock(),
				provideAuthMock(),
				provideFunctionsMock(),
				provideStorageMock(),
				provideTranslateServiceMock(),
				{
					provide: PopoverController,
					useValue: createPopoverControllerMock(),
				},
				provideActivatedRouteMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(PreRegistrationPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
