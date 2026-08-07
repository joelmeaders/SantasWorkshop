import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegistrationPage } from './registration.page';
import {
	provideFirestoreWrapperMock,
	provideModalControllerMock,
	provideFunctionsMock,
	provideActivatedRouteMock,
} from '../../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('RegistrationPage', () => {
	let component: RegistrationPage;
	let fixture: ComponentFixture<RegistrationPage>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [RegistrationPage],
			providers: [
				provideFirestoreWrapperMock(),
				provideModalControllerMock(),
				provideFunctionsMock(),
				provideActivatedRouteMock(),
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(RegistrationPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
