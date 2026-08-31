import { Routes } from '@angular/router';
import { CheckedInGuard } from '../../../core/guards/checked-in.guard';
import { RegistrationCompleteGuard } from '../../../core/guards/registration-complete.guard';
import { RegistrationIncompleteGuard } from '../../../core/guards/registration-incomplete.guard';
import { FULL_FIRESTORE_ROUTE_PROVIDERS } from './full-firestore.providers';

export const preRegistrationRoutes: Routes = [
	{
		path: '',
		loadComponent: () =>
			import('./pre-registration.page').then(
				(module) => module.PreRegistrationPage,
			),
		providers: FULL_FIRESTORE_ROUTE_PROVIDERS,
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
