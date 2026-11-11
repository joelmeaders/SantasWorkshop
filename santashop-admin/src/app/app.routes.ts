import { Routes } from '@angular/router';
import { elevatedUserGuard, redirectLoggedInToAdminGuard } from './auth.guards';

export const routes: Routes = [
	{
		path: 'reset-password',
		title: 'DSCS Password Reset',
		loadComponent: () =>
			import('./pages/reset-password/reset-password.page').then(
				(m) => m.ResetPasswordPage,
			),
	},
	{
		path: '',
		title: 'DSCS Sign In',
		canActivate: [redirectLoggedInToAdminGuard],
		loadComponent: () =>
			import('./pages/sign-in/sign-in.page').then((m) => m.SignInPage),
	},
	{
		path: 'admin',
		canMatch: [elevatedUserGuard],
		loadChildren: () =>
			import('./admin-firestore.routes').then(
				(module) => module.adminFirestoreRoutes,
			),
	},
];
