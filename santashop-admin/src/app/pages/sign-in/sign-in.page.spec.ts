import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SignInPage } from './sign-in.page';
import {
} from '../../../test-helpers';
import { provideRouter, Router } from '@angular/router';
import { AlertController } from '@ionic/angular/standalone';
import { AuthService } from '@santashop/core';

describe('SignInPage', () => {
	let component: SignInPage;
	let fixture: ComponentFixture<SignInPage>;
	const login = vi.fn();
	const alert = { present: vi.fn().mockResolvedValue(undefined) };
	const createAlert = vi.fn().mockResolvedValue(alert);

	beforeEach(async () => {
		login.mockReset(); alert.present.mockClear(); createAlert.mockClear();
		TestBed.configureTestingModule({
			imports: [SignInPage],
			providers: [
				{ provide: AuthService, useValue: { login } },
				{ provide: AlertController, useValue: { create: createAlert } },
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

	it('authenticates a valid staff user and opens the admin landing route', async () => {
		login.mockResolvedValue(undefined);
		(component as unknown as { form: { patchValue(value: object): void } }).form.patchValue({
			emailAddress: 'staff@example.test', password: 'secret',
		});
		const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

		await component.login();

		expect(login).toHaveBeenCalledWith({ emailAddress: 'staff@example.test', password: 'secret' });
		expect(navigate).toHaveBeenCalledWith(['/admin']);
	});

	it.each([
		['auth/wrong-password', 'Wrong Password'],
		['auth/user-not-found', 'Wrong Email Address'],
		['auth/too-many-requests', 'Account locked out'],
		['other', 'Unknown Error'],
	])('explains %s login errors as %s', async (code, header) => {
		login.mockRejectedValue(new Error(`Firebase: ${code}`));

		await component.login();

		expect(createAlert).toHaveBeenCalledWith({
			header,
			message: code,
			buttons: ['Ok'],
		});
		expect(alert.present).toHaveBeenCalledOnce();
	});
});
