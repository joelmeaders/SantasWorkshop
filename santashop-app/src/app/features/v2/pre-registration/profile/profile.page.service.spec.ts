import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import {
	AnalyticsWrapper,
	AuthService,
	ErrorHandlerService,
	FireRepoLite,
	FunctionsWrapper,
} from '@santashop/core';
import type { User } from '@santashop/models';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePageService } from './profile.page.service';

describe('ProfilePageService', () => {
	const currentUser$ = new Subject<{ uid: string } | null>();
	const auth = { currentUser$, changeEmailAddress: vi.fn(), changePassword: vi.fn() };
	const read = vi.fn();
	const collection = vi.fn().mockReturnValue({ read });
	const functions = { changeAccountInformation: vi.fn() };
	const errors = { handleError: vi.fn() };
	const alert = { create: vi.fn() };
	const loading = { create: vi.fn() };
	const router = { navigate: vi.fn() };
	const analytics = { logEvent: vi.fn() };

	beforeEach(() => {
		read.mockReset();
		collection.mockClear();
		functions.changeAccountInformation.mockReset();
		errors.handleError.mockReset();
		alert.create.mockReset();
		loading.create.mockReset();
		router.navigate.mockReset();
		analytics.logEvent.mockReset();
		auth.changeEmailAddress.mockReset();
		auth.changePassword.mockReset();
		TestBed.configureTestingModule({
			providers: [
				ProfilePageService,
				{ provide: AuthService, useValue: auth },
				{ provide: FireRepoLite, useValue: { collection } },
				{ provide: FunctionsWrapper, useValue: functions },
				{ provide: ErrorHandlerService, useValue: errors },
				{ provide: AlertController, useValue: alert },
				{ provide: LoadingController, useValue: loading },
				{ provide: Router, useValue: router },
				{ provide: TranslateService, useValue: { instant: vi.fn().mockReturnValue('translated') } },
				{ provide: AnalyticsWrapper, useValue: analytics },
			],
		});
	});

	it('ignores signed-out auth emissions and loads the next authenticated profile', () => {
		const profile = {
			uid: 'customer-1',
			firstName: 'Holly',
			lastName: 'Jolly',
			zipCode: '80202',
		} as User;
		read.mockReturnValue(of(profile));

		const service = TestBed.inject(ProfilePageService);

		expect(() => currentUser$.next(null)).not.toThrow();
		expect(collection).not.toHaveBeenCalled();

		currentUser$.next({ uid: 'customer-1' });

		expect(read).toHaveBeenCalledWith('customer-1');
		expect(service.profileForm.value).toMatchObject({
			firstName: 'Holly',
			lastName: 'Jolly',
			zipCode: 80202,
		});
	});

	it('updates public profile, persists the local view, and always closes its loader', async (): Promise<void> => {
		read.mockReturnValue(of({ uid: 'customer-1', firstName: 'Holly', lastName: 'Jolly', zipCode: '80202' } as User));
		const loader = { present: vi.fn().mockResolvedValue(undefined), dismiss: vi.fn().mockResolvedValue(undefined) };
		loading.create.mockResolvedValue(loader);
		functions.changeAccountInformation.mockResolvedValue(undefined);
		router.navigate.mockResolvedValue(true);
		const service = TestBed.inject(ProfilePageService);
		currentUser$.next({ uid: 'customer-1' });
		service.profileForm.setValue({ firstName: 'Noel', lastName: 'Bell', zipCode: 80203 });

		await service.updatePublicProfile();

		expect(functions.changeAccountInformation).toHaveBeenCalledWith({ firstName: 'Noel', lastName: 'Bell', zipCode: 80203 });
		expect(analytics.logEvent).toHaveBeenCalledWith('profile_update_info');
		expect(loader.dismiss).toHaveBeenCalledOnce();
		expect(router.navigate).toHaveBeenCalledWith(['/pre-registration/profile']);
	});

	it('presents the email and password completion confirmations', async (): Promise<void> => {
		const present = vi.fn().mockResolvedValue(undefined);
		const onDidDismiss = vi.fn().mockResolvedValue({ role: 'ok' });
		alert.create.mockResolvedValue({ present, onDidDismiss });
		const service = TestBed.inject(ProfilePageService);

		await expect(service.emailChangedAlert()).resolves.toEqual({ role: 'ok' });
		await expect(service.passwordChangedAlert()).resolves.toEqual({ role: 'ok' });

		expect(alert.create).toHaveBeenCalledTimes(2);
		expect(present).toHaveBeenCalledTimes(2);
	});

	it('changes email and password, then returns to the account page', async (): Promise<void> => {
		const present = vi.fn().mockResolvedValue(undefined);
		alert.create.mockResolvedValue({ present, onDidDismiss: vi.fn().mockResolvedValue({}) });
		auth.changeEmailAddress.mockResolvedValue(undefined);
		auth.changePassword.mockResolvedValue(undefined);
		router.navigate.mockResolvedValue(true);
		const service = TestBed.inject(ProfilePageService);
		service.changeEmailForm.setValue({ emailAddress: 'new@example.com', password: 'secret' });
		service.changePasswordForm.setValue({ oldPassword: 'old-secret', newPassword: 'new-secret', newPassword2: 'new-secret' });

		await service.changeEmailAddress();
		await service.changePassword();

		expect(auth.changeEmailAddress).toHaveBeenCalledWith('secret', 'new@example.com');
		expect(auth.changePassword).toHaveBeenCalledWith('old-secret', 'new-secret');
		expect(router.navigate).toHaveBeenCalledTimes(2);
		service.ngOnDestroy();
	});
});
