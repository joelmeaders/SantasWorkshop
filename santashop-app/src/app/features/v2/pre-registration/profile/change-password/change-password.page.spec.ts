import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {
	provideAnalyticsMock,
	provideAuthMock,
	provideFirestoreMock,
	provideFunctionsMock,
	provideStorageMock,
	provideTranslateServiceMock,
	provideActivatedRouteMock,
} from '../../../../../../test-helpers';

import { ChangePasswordPage } from './change-password.page';

describe('ChangePasswordPage', () => {
	let component: ChangePasswordPage;
	let fixture: ComponentFixture<ChangePasswordPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ChangePasswordPage],
			providers: [
				provideFirestoreMock(),
				provideAuthMock(),
				provideFunctionsMock(),
				provideStorageMock(),
				provideAnalyticsMock(),
				provideTranslateServiceMock(),
				provideActivatedRouteMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(ChangePasswordPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
