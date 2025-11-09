import { Routes } from '@angular/router';
import {
	AuthGuard,
	AuthPipe,
	hasCustomClaim,
	redirectLoggedInTo,
} from '@angular/fire/auth-guard';

const adminOnly = (): AuthPipe => hasCustomClaim('admin');
const redirectLoggedInToAdmin = (): AuthPipe => redirectLoggedInTo(['admin']);

export const routes: Routes = [
	{
		path: '',
		title: 'DSCS Sign In',
		data: { authGuardPipe: redirectLoggedInToAdmin },
		loadComponent: () =>
			import('./pages/sign-in/sign-in.page').then((m) => m.SignInPage),
	},
	{
		path: 'admin',
		title: 'DSCS Home',
		canActivate: [AuthGuard],
		data: { authGuardPipe: adminOnly },
		loadChildren: () =>
			import('./pages/admin/admin.module').then((m) => m.AdminPageModule),
	},
];
