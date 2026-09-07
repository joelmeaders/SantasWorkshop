import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SignInPage } from './sign-in.page';
import { provideRouter, Router } from '@angular/router';
import { AlertController } from '@ionic/angular/standalone';
import { AuthService } from '@santashop/core/admin';
import { config } from '../../../config';

describe('SignInPage', () => {
	let component: SignInPage;
	let fixture: ComponentFixture<SignInPage>;
	const login = vi.fn();
	const getCurrentUserToken = vi.fn();
	const alert = { present: vi.fn().mockResolvedValue(undefined) };
	const createAlert = vi.fn().mockResolvedValue(alert);

	beforeEach(async () => {
		login.mockReset();
		getCurrentUserToken.mockReset();
		getCurrentUserToken.mockResolvedValue({ claims: { roles: ['admin'] } });
		alert.present.mockClear();
		createAlert.mockClear();
		TestBed.configureTestingModule({
			imports: [SignInPage],
			providers: [
				{
					provide: AuthService,
					useValue: { login, getCurrentUserToken },
				},
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

	it('renders the configured release version and environment', () => {
		expect(component.environmentVersion).toBe(config.version);
		expect(component.environmentName).toBe(
			`${config.name}_${config.label}`,
		);
		const releaseNote = fixture.nativeElement.querySelector('ion-note');
		expect(releaseNote.textContent).toContain(config.version);
		expect(releaseNote.textContent).toContain(
			`${config.name}_${config.label}`,
		);
	});

	it('provides programmatic labels for both sign-in fields', () => {
		const inputs = fixture.nativeElement.querySelectorAll(
			'ion-input',
		) as NodeListOf<HTMLIonInputElement>;

		expect([...inputs].map((input) => input.label)).toEqual([
			'Email Address',
			'Password',
		]);
	});

	it('authenticates a valid staff user and opens the admin landing route', async () => {
		login.mockResolvedValue(undefined);
		(
			component as unknown as {
				form: { patchValue(value: object): void };
			}
		).form.patchValue({
			emailAddress: 'staff@example.test',
			password: 'secret',
		});
		const navigate = vi
			.spyOn(TestBed.inject(Router), 'navigate')
			.mockResolvedValue(true);

		await component.login();

		expect(login).toHaveBeenCalledWith({
			emailAddress: 'staff@example.test',
			password: 'secret',
		});
		expect(getCurrentUserToken).toHaveBeenCalledOnce();
		expect(navigate).toHaveBeenCalledWith(['/admin']);
	});

	it.each([
		['owner', { owner: true }],
		['admin', { roles: ['admin'] }],
		['check-in', { roles: ['checkin'] }],
	])(
		'opens the admin route for a staff token with %s access',
		async (_role, claims) => {
			login.mockResolvedValue(undefined);
			getCurrentUserToken.mockResolvedValue({ claims });
			(
				component as unknown as {
					form: { patchValue(value: object): void };
				}
			).form.patchValue({
				emailAddress: 'staff@example.test',
				password: 'secret',
			});
			const navigate = vi
				.spyOn(TestBed.inject(Router), 'navigate')
				.mockResolvedValue(true);

			await component.login();

			expect(navigate).toHaveBeenCalledWith(['/admin']);
			expect(createAlert).not.toHaveBeenCalled();
		},
	);

	it.each([
		['empty claims', {}],
		['null claims', null],
		['an array of claims', []],
		['a non-array roles claim', { roles: 'admin' }],
		['an array of non-staff roles', { roles: ['stats'] }],
	])(
		'explains that a signed-in user lacks staff access for %s',
		async (_case, claims) => {
			login.mockResolvedValue(undefined);
			getCurrentUserToken.mockResolvedValue({ claims });
			(
				component as unknown as {
					form: { patchValue(value: object): void };
				}
			).form.patchValue({
				emailAddress: 'customer@example.test',
				password: 'secret',
			});

			await component.login();

			expect(createAlert).toHaveBeenCalledWith({
				header: 'Access Denied',
				message:
					'Your account is signed in, but it does not have staff access. Contact an administrator if you need access.',
				buttons: ['Ok'],
			});
			expect(alert.present).toHaveBeenCalledOnce();
		},
	);

	it('does not submit again while a sign-in request is pending', async () => {
		let resolveLogin: (() => void) | undefined;
		login.mockReturnValue(
			new Promise<void>((resolve) => {
				resolveLogin = resolve;
			}),
		);
		(
			component as unknown as {
				form: { patchValue(value: object): void };
			}
		).form.patchValue({
			emailAddress: 'staff@example.test',
			password: 'secret',
		});
		const navigate = vi
			.spyOn(TestBed.inject(Router), 'navigate')
			.mockResolvedValue(true);
		const button = fixture.nativeElement.querySelector(
			'#adminSignInButton',
		) as HTMLIonButtonElement;
		fixture.detectChanges();
		expect(button.disabled).toBe(false);

		const firstLogin = component.login();
		await component.login();

		expect(login).toHaveBeenCalledOnce();
		await fixture.whenStable();
		expect(button.disabled).toBe(true);
		resolveLogin?.();
		await firstLogin;
		await fixture.whenStable();
		expect(button.disabled).toBe(false);
		expect(navigate).toHaveBeenCalledWith(['/admin']);
	});

	it.each([
		['auth/wrong-password', 'Wrong Password'],
		['auth/user-not-found', 'Wrong Email Address'],
		['auth/too-many-requests', 'Account locked out'],
		['other', 'Unknown Error'],
	])('explains %s login errors as %s', async (code, header) => {
		login.mockRejectedValue(new Error(`Firebase: ${code}`));
		(
			component as unknown as {
				form: { patchValue(value: object): void };
			}
		).form.patchValue({
			emailAddress: 'staff@example.test',
			password: 'secret',
		});

		await component.login();

		expect(createAlert).toHaveBeenCalledWith({
			header,
			message: code,
			buttons: ['Ok'],
		});
		expect(alert.present).toHaveBeenCalledOnce();
	});
});
