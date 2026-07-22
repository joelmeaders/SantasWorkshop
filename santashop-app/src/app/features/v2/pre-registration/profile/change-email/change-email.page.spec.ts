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

import { ChangeEmailPage } from './change-email.page';

describe('ChangeEmailPage', () => {
	let component: ChangeEmailPage;
	let fixture: ComponentFixture<ChangeEmailPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ChangeEmailPage],
			providers: [
				provideFirestoreMock(),
				provideAuthMock(),
				provideFunctionsMock(),
				provideAnalyticsMock(),
				provideStorageMock(),
				provideTranslateServiceMock(),
				provideActivatedRouteMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(ChangeEmailPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
