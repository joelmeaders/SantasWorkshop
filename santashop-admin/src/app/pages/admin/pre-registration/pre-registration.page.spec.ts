import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PreRegistrationPage } from './pre-registration.page';
import {
	provideFirestoreWrapperMock,
	provideFunctionsMock,
	provideModalControllerMock,
	provideAlertControllerMock,
	provideLoadingControllerMock,
	provideActivatedRouteMock,
	provideProgramYearMock,
} from '../../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('PreRegistrationPage', () => {
	let component: PreRegistrationPage;
	let fixture: ComponentFixture<PreRegistrationPage>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [PreRegistrationPage],
			providers: [
				provideFirestoreWrapperMock(),
				provideFunctionsMock(),
				provideModalControllerMock(),
				provideAlertControllerMock(),
				provideLoadingControllerMock(),
				provideActivatedRouteMock(),
				provideProgramYearMock(2026),
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(PreRegistrationPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
