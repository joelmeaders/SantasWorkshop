import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SignInPage } from './sign-in.page';
import {
	provideAuthMock,
	provideAlertControllerMock,
	provideFunctionsMock,
} from '../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('SignInPage', () => {
	let component: SignInPage;
	let fixture: ComponentFixture<SignInPage>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [SignInPage],
			providers: [
				provideAuthMock(),
				provideAlertControllerMock(),
				provideFunctionsMock(),
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(SignInPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
