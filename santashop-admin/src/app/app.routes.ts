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
		loadComponent: () =>
			import('./pages/admin/admin.page').then((m) => m.AdminPage),
		children: [
			{
				path: 'landing',
				loadComponent: () =>
					import('./pages/admin/landing/landing.page').then(
						(m) => m.LandingPage,
					),
			},
			{
				path: 'checkin',
				title: 'DSCS: Check In',
				children: [
					{
						path: '',
						redirectTo: 'scan',
						pathMatch: 'full',
					},
					{
						path: 'scan',
						title: 'DSCS: Scan Registration Codes',
						loadComponent: () =>
							import('./pages/admin/checkin/scan/scan.page').then(
								(m) => m.ScanPage,
							),
					},
					{
						path: 'review',
						title: 'DSCS: Review Information',
						loadComponent: () =>
							import('./pages/admin/checkin/review/review.page').then(
								(m) => m.ReviewPage,
							),
					},
					{
						path: 'confirmation',
						title: 'DSCS: Checked In',
						loadComponent: () =>
							import('./pages/admin/checkin/confirmation/confirmation.page').then(
								(m) => m.ConfirmationPage,
							),
					},
					{
						path: 'duplicate/:uid',
						title: 'DSCS: Duplicate Check-In',
						loadComponent: () =>
							import('./pages/admin/checkin/duplicate/duplicate.page').then(
								(m) => m.DuplicatePage,
							),
					},
				],
			},
			{
				path: 'search',
				title: 'DSCS: Search',
				loadComponent: () =>
					import('./pages/admin/search/search.page').then(
						(m) => m.SearchPage,
					),
				children: [
					{
						path: 'by-name',
						title: 'DSCS: Search By Name',
						loadComponent: () =>
							import('./pages/admin/search/by-name/by-name.page').then(
								(m) => m.ByNamePage,
							),
					},
					{
						path: 'by-email',
						title: 'DSCS: Search By Email',
						loadComponent: () =>
							import('./pages/admin/search/by-email/by-email.page').then(
								(m) => m.ByEmailPage,
							),
					},
					{
						path: 'by-code',
						title: 'DSCS: Search By Code',
						loadComponent: () =>
							import('./pages/admin/search/by-code/by-code.page').then(
								(m) => m.ByCodePage,
							),
					},
					{
						path: 'results',
						title: 'DSCS: Search Results',
						loadComponent: () =>
							import('./pages/admin/search/results/results.page').then(
								(m) => m.ResultsPage,
							),
					},
				],
			},
			{
				path: 'registration',
				title: 'DSCS: Register',
				loadComponent: () =>
					import('./pages/admin/registration/registration.page').then(
						(m) => m.RegistrationPage,
					),
			},
			{
				path: 'pre-registration',
				title: 'DSCS: Pre-Registration',
				loadComponent: () =>
					import('./pages/admin/pre-registration/pre-registration.page').then(
						(m) => m.PreRegistrationPage,
					),
			},
			{
				path: 'resend-email',
				title: 'DSCS: Resend Email',
				loadComponent: () =>
					import('./pages/admin/tools/resend-email/resend-email.page').then(
						(m) => m.ResendEmailPage,
					),
			},
			{
				path: '',
				redirectTo: 'landing',
				pathMatch: 'full',
			},
		],
	},
	{
		path: 'admin/stats',
		children: [
			{
				path: 'registration',
				loadComponent: () =>
					import('./pages/admin/stats/registration/registration.page').then(
						(m) => m.RegistrationPage,
					),
			},
			{
				path: 'check-in',
				loadComponent: () =>
					import('./pages/admin/stats/check-in/check-in.page').then(
						(m) => m.CheckInPage,
					),
			},
			{
				path: 'user',
				loadComponent: () =>
					import('./pages/admin/stats/user/user.page').then(
						(m) => m.UserPage,
					),
			},
		],
	},
];
