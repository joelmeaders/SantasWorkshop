import { inject } from '@angular/core';
import { AuthService } from '@santashop/core';
import { map, take } from 'rxjs/operators';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { CheckedInGuard } from './core/guards/checked-in.guard';
import { RegistrationCompleteGuard } from './core/guards/registration-complete.guard';
import { RegistrationIncompleteGuard } from './core/guards/registration-incomplete.guard';

const redirectUnauthorizedToLoginGuard: CanActivateFn = (_route, state) => {
	const authService = inject(AuthService);
	const router = inject(Router);

	return authService.currentUser$.pipe(
		take(1),
		map((user) =>
			user
				? true
				: router.createUrlTree(['/'], {
						queryParams: {
							mode: 'sign-in',
							returnUrl: state.url,
						},
					}),
		),
	);
};

const redirectLoggedInToRegistrationGuard: CanActivateFn = () => {
	const authService = inject(AuthService);
	const router = inject(Router);

	return authService.currentUser$.pipe(
		take(1),
		map((user) =>
			user ? router.createUrlTree(['/pre-registration/overview']) : true,
		),
	);
};

export const routes: Routes = [
	{
		path: '',
		canActivate: [redirectLoggedInToRegistrationGuard],
		loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
		pathMatch: 'full',
		title: 'Santa Shop Registration',
	},
	{
		path: 'sign-up',
		canActivate: [redirectLoggedInToRegistrationGuard],
		loadComponent: () =>
			import('./features/v2/sign-up/sign-up.page').then(
				(m) => m.SignUpPage,
			),
		title: 'Create Account | Santa Shop Registration',
	},
	{
		path: 'pre-registration',
		canActivate: [redirectUnauthorizedToLoginGuard],
		loadComponent: () =>
			import('./features/v2/pre-registration/pre-registration.page').then(
				(m) => m.PreRegistrationPage,
			),
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
					import('./features/v2/pre-registration/overview/overview.page').then(
						(m) => m.OverviewPage,
					),
				title: 'Registration | Santa Shop',
			},
			{
				path: 'confirmation',
				canActivate: [RegistrationIncompleteGuard],
				loadComponent: () =>
					import('./features/v2/pre-registration/confirmation/confirmation.page').then(
						(m) => m.ConfirmationPage,
					),
				title: 'Registration Confirmation | Santa Shop',
			},
			{
				path: 'profile',
				loadComponent: () =>
					import('./features/v2/pre-registration/profile/profile.page').then(
						(m) => m.ProfilePage,
					),
				title: 'My Account | Santa Shop',
			},
		],
	},
	{ path: '**', redirectTo: '' },
];
