import { inject } from '@angular/core';
import { AuthService } from '@santashop/core/customer';
import { map, take } from 'rxjs/operators';
import {
	CanActivateFn,
	CanMatchFn,
	Router,
	Routes,
} from '@angular/router';

export const redirectUnauthorizedToLoginGuard: CanMatchFn = (
	_route,
	segments,
) => {
	const authService = inject(AuthService);
	const router = inject(Router);
	const returnUrl =
		router.getCurrentNavigation()?.extractedUrl.toString() ??
		`/${segments.map((segment) => segment.path).join('/')}`;

	return authService.currentUser$.pipe(
		take(1),
		map((user) =>
			user
				? true
				: router.createUrlTree(['/'], {
					queryParams: {
							mode: 'sign-in',
							returnUrl,
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
		canMatch: [redirectUnauthorizedToLoginGuard],
		loadChildren: () =>
			import('./features/v2/pre-registration/pre-registration.routes').then(
				(module) => module.preRegistrationRoutes,
			),
	},
	{ path: '**', redirectTo: '' },
];
