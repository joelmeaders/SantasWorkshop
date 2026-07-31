import { inject } from '@angular/core';
import { AuthService } from '@santashop/core';
import { from, of } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { CanActivateFn, Router, Routes } from '@angular/router';

const redirectLoggedInToAdminGuard: CanActivateFn = () => {
	const authService = inject(AuthService);
	const router = inject(Router);

	return authService.currentUser$.pipe(
		take(1),
		switchMap((user) => {
			if (!user) {
				return of(true);
			}

			return from(user.getIdTokenResult(false)).pipe(
				map((token) => {
					const claims = token.claims ?? {};
					const roles =
						(claims['roles'] as string[] | undefined) ?? [];

					return claims['owner'] === true ||
						claims['admin'] === true ||
						roles.length > 0
						? router.createUrlTree(['/admin'])
						: true;
				}),
			);
		}),
	);
};

const adminOnlyGuard: CanActivateFn = () => {
	const authService = inject(AuthService);
	const router = inject(Router);

	return authService.currentUser$.pipe(
		take(1),
		switchMap((user) => {
			if (!user) {
				return of(router.createUrlTree(['/']));
			}

			return from(user.getIdTokenResult(false)).pipe(
				map((token) =>
					token.claims?.['owner'] === true ||
					token.claims?.['admin'] === true
						? true
						: router.createUrlTree(['/']),
				),
			);
		}),
	);
};

const elevatedUserGuard: CanActivateFn = () => {
	const authService = inject(AuthService);
	const router = inject(Router);

	return authService.currentUser$.pipe(
		take(1),
		switchMap((user) => {
			if (!user) {
				return of(router.createUrlTree(['/']));
			}

			return from(user.getIdTokenResult(false)).pipe(
				map((token) => {
					const claims = token.claims ?? {};
					const roles =
						(claims['roles'] as string[] | undefined) ?? [];

					return claims['owner'] === true ||
						claims['admin'] === true ||
						roles.length > 0
						? true
						: router.createUrlTree(['/']);
				}),
			);
		}),
	);
};

const ownerOnlyGuard: CanActivateFn = () => {
	const authService = inject(AuthService);
	const router = inject(Router);

	return authService.currentUser$.pipe(
		take(1),
		switchMap((user) => {
			if (!user) {
				return of(router.createUrlTree(['/']));
			}

			return from(user.getIdTokenResult(false)).pipe(
				map((token) =>
					token.claims?.['owner'] === true
						? true
						: router.createUrlTree(['/admin/landing']),
				),
			);
		}),
	);
};

export const routes: Routes = [
	{
		path: '',
		title: 'DSCS Sign In',
		canActivate: [redirectLoggedInToAdminGuard],
		loadComponent: () =>
			import('./pages/sign-in/sign-in.page').then((m) => m.SignInPage),
	},
	{
		path: 'admin',
		title: 'DSCS Home',
		canActivate: [elevatedUserGuard],
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
				canActivate: [adminOnlyGuard],
				loadComponent: () =>
					import('./pages/admin/tools/resend-email/resend-email.page').then(
						(m) => m.ResendEmailPage,
					),
			},
			{
				path: 'schedule-editor',
				title: 'DSCS: Schedule Editor',
				canActivate: [adminOnlyGuard],
				loadComponent: () =>
					import('./pages/admin/tools/schedule-editor/schedule-editor.page').then(
						(m) => m.ScheduleEditorPage,
					),
			},
			{
				path: 'email-templates',
				title: 'DSCS: Email Templates',
				canActivate: [adminOnlyGuard],
				loadComponent: () =>
					import('./pages/admin/tools/email-templates/email-templates.page').then(
						(m) => m.EmailTemplatesPage,
					),
			},
			{
				path: 'email-templates/create',
				title: 'DSCS: Create Email Template',
				canActivate: [adminOnlyGuard],
				loadComponent: () =>
					import('./pages/admin/tools/email-templates/email-template-editor.page').then(
						(m) => m.EmailTemplateEditorPage,
					),
			},
			{
				path: 'email-templates/:key',
				title: 'DSCS: Edit Email Template',
				canActivate: [adminOnlyGuard],
				loadComponent: () =>
					import('./pages/admin/tools/email-templates/email-template-editor.page').then(
						(m) => m.EmailTemplateEditorPage,
					),
			},
			{
				path: 'owner-operations',
				title: 'DSCS: Owner Operations',
				canActivate: [ownerOnlyGuard],
				loadComponent: () =>
					import('./pages/admin/tools/owner-operations/owner-operations.page').then(
						(m) => m.OwnerOperationsPage,
					),
			},
			{
				path: 'users',
				title: 'DSCS: User Management',
				canActivate: [adminOnlyGuard],
				loadComponent: () =>
					import('./pages/admin/users/users.page').then(
						(m) => m.UsersPage,
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
		canActivate: [adminOnlyGuard],
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
