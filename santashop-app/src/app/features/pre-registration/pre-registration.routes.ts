import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService, ErrorHandlerService } from '@santashop/core/customer';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ShopperAccessService } from '../../core/services/shopper-access.service';
import { CheckedInGuard } from '../../core/guards/checked-in.guard';
import { RegistrationCompleteGuard } from '../../core/guards/registration-complete.guard';
import { RegistrationIncompleteGuard } from '../../core/guards/registration-incomplete.guard';
import { FULL_FIRESTORE_ROUTE_PROVIDERS } from './full-firestore.providers';

const shopperAccessGuard: CanActivateFn = async () => {
	const auth = inject(AuthService);
	const shopperAccess = inject(ShopperAccessService);
	const router = inject(Router);
	const errors = inject(ErrorHandlerService);
	const translate = inject(TranslateService);
	const login = router.createUrlTree(['/'], { queryParams: { mode: 'sign-in' } });
	const uid = (await firstValueFrom(auth.currentUser$))?.uid;
	if (!uid) return login;

	try {
		return (await shopperAccess.verify(uid)) ? true : login;
	} catch {
		if ((await firstValueFrom(auth.currentUser$))?.uid === uid) {
			await auth.logout(false);
			void errors.handleError({ details: translate.instant('SHOPPER_ACCESS.VERIFICATION_FAILED') });
		}
		return login;
	}
};

export const preRegistrationRoutes: Routes = [
	{
		path: '',
		loadComponent: () =>
			import('./pre-registration.page').then(
				(module) => module.PreRegistrationPage,
			),
		providers: FULL_FIRESTORE_ROUTE_PROVIDERS,
		canActivate: [shopperAccessGuard],
		canActivateChild: [CheckedInGuard],
		children: [
			{
				path: '',
				pathMatch: 'full',
				redirectTo: 'overview',
			},
			{
				path: 'overview',
				canActivate: [RegistrationCompleteGuard],
				loadComponent: () =>
					import('./overview/overview.page').then(
						(module) => module.OverviewPage,
					),
				title: 'Registration | Santa Shop',
			},
			{
				path: 'confirmation',
				canActivate: [RegistrationIncompleteGuard],
				loadComponent: () =>
					import('./confirmation/confirmation.page').then(
						(module) => module.ConfirmationPage,
					),
				title: 'Registration Confirmation | Santa Shop',
			},
			{
				path: 'profile',
				loadComponent: () =>
					import('./profile/profile.page').then(
						(module) => module.ProfilePage,
					),
				title: 'My Account | Santa Shop',
			},
		],
	},
];
