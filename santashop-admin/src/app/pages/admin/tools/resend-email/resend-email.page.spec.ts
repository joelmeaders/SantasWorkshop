import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResendEmailPage } from './resend-email.page';
import {
	provideFirestoreWrapperMock,
	provideFunctionsMock,
	provideAlertControllerMock,
	provideLoadingControllerMock,
	provideActivatedRouteMock,
} from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('ResendEmailPage', () => {
	let component: ResendEmailPage;
	let fixture: ComponentFixture<ResendEmailPage>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [ResendEmailPage],
			providers: [
				provideFirestoreWrapperMock(),
				provideFunctionsMock(),
				provideAlertControllerMock(),
				provideLoadingControllerMock(),
				provideActivatedRouteMock(),
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(ResendEmailPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
