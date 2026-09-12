import { Routes } from '@angular/router';
import { adminOnlyGuard, ownerOnlyGuard } from './auth.guards';

export const adminRoutes: Routes = [
	{
		path: '',
		title: 'DSCS Home',
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
				children: [
					{
						path: '',
						pathMatch: 'full',
						loadComponent: () =>
							import('./pages/admin/search/search.page').then(
								(m) => m.SearchPage,
							),
					},
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
				canActivate: [adminOnlyGuard],
				loadComponent: () =>
					import('./pages/admin/registration/registration.page').then(
						(m) => m.RegistrationPage,
					),
			},
			{
				path: 'pre-registration',
				title: 'DSCS: Pre-Registration',
				canActivate: [adminOnlyGuard],
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
				path: 'app-settings',
				title: 'DSCS: App settings',
				canActivate: [ownerOnlyGuard],
				loadComponent: () =>
					import('./pages/admin/tools/app-settings/app-settings.page').then(
						(m) => m.AppSettingsPage,
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
			{
				path: 'stats',
				canActivate: [adminOnlyGuard],
				children: [
					{
						path: 'scan-risk',
						loadComponent: () =>
							import('./pages/admin/stats/scan-risk/scan-risk.page').then(
								(m) => m.ScanRiskPage,
							),
					},
					{
						path: 'scan-risk/:uid',
						loadComponent: () =>
							import('./pages/admin/stats/scan-risk/scan-risk-detail.page').then(
								(m) => m.ScanRiskDetailPage,
							),
					},
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
		],
	},
];
