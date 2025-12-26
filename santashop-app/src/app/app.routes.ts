import {
	AuthGuard,
	AuthPipe,
	redirectLoggedInTo,
	redirectUnauthorizedTo,
} from '@angular/fire/auth-guard';
import { Routes } from '@angular/router';
import { CheckedInGuard } from './core/guards/checked-in.guard';
import { RegistrationCompleteGuard } from './core/guards/registration-complete.guard';
import { RegistrationIncompleteGuard } from './core/guards/registration-incomplete.guard';
import { RegistrationReadyToSubmitGuard } from './core/guards/registration-ready-to-submit.guard';

const redirectUnauthorizedToLogin = (): AuthPipe =>
	redirectUnauthorizedTo(['/sign-in']);

const redirectLoggedInToRegistration = (): AuthPipe =>
	redirectLoggedInTo(['/pre-registration/overview']);

export const routes: Routes = [
	{
		path: '',
		loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
		pathMatch: 'full',
	},
	{
		path: 'sign-in',
		loadComponent: () =>
			import('./features/v2/sign-in/sign-in.page').then(
				(m) => m.SignInPage,
			),
		data: { authGuardPipe: redirectLoggedInToRegistration },
	},
	{
		path: 'sign-up',
		loadComponent: () =>
			import('./features/v2/sign-up/sign-up.page').then(
				(m) => m.SignUpPage,
			),
		canActivate: [AuthGuard],
		data: { authGuardPipe: redirectLoggedInToRegistration },
	},
	{
		path: 'pre-registration',
		loadComponent: () =>
			import('./features/v2/pre-registration/pre-registration.page').then(
				(m) => m.PreRegistrationPage,
			),
		canActivate: [AuthGuard],
		canActivateChild: [CheckedInGuard],
		data: { authGuardPipe: redirectUnauthorizedToLogin },
		children: [
			{
				path: 'overview',
				canActivateChild: [RegistrationCompleteGuard],
				loadComponent: () =>
					import('./features/v2/pre-registration/overview/overview.page').then(
						(m) => m.OverviewPage,
					),
			},
			{
				path: 'children',
				canActivateChild: [RegistrationCompleteGuard],
				loadComponent: () =>
					import('./features/v2/pre-registration/children/children.page').then(
						(m) => m.ChildrenPage,
					),
				children: [
					{
						path: 'add-child',
						loadComponent: () =>
							import('./features/v2/pre-registration/children/add-child/add-child.page').then(
								(m) => m.AddChildPage,
							),
					},
					{
						path: 'add-child/:id',
						loadComponent: () =>
							import('./features/v2/pre-registration/children/add-child/add-child.page').then(
								(m) => m.AddChildPage,
							),
					},
				],
			},
			{
				path: 'date-time',
				canActivateChild: [RegistrationCompleteGuard],
				loadComponent: () =>
					import('./features/v2/pre-registration/date-time/date-time.page').then(
						(m) => m.DateTimePage,
					),
			},
			{
				path: 'submit',
				canActivateChild: [
					RegistrationReadyToSubmitGuard,
					RegistrationCompleteGuard,
				],
				loadComponent: () =>
					import('./features/v2/pre-registration/submit/submit.page').then(
						(m) => m.SubmitPage,
					),
			},
			{
				path: 'confirmation',
				canActivateChild: [RegistrationIncompleteGuard],
				loadComponent: () =>
					import('./features/v2/pre-registration/confirmation/confirmation.page').then(
						(m) => m.ConfirmationPage,
					),
				children: [
					{
						path: 'event-information',
						loadComponent: () =>
							import('./features/v2/pre-registration/confirmation/event-information/event-information.page').then(
								(m) => m.EventInformationPage,
							),
					},
				],
			},
			{
				path: 'profile',
				loadComponent: () =>
					import('./features/v2/pre-registration/profile/profile.page').then(
						(m) => m.ProfilePage,
					),
				children: [
					{
						path: 'change-info',
						loadComponent: () =>
							import('./features/v2/pre-registration/profile/change-info/change-info.page').then(
								(m) => m.ChangeInfoPage,
							),
					},
					{
						path: 'change-email',
						loadComponent: () =>
							import('./features/v2/pre-registration/profile/change-email/change-email.page').then(
								(m) => m.ChangeEmailPage,
							),
					},
					{
						path: 'change-password',
						loadComponent: () =>
							import('./features/v2/pre-registration/profile/change-password/change-password.page').then(
								(m) => m.ChangePasswordPage,
							),
					},
				],
			},
			{
				path: 'help',
				loadChildren: () =>
					import('./features/v2/pre-registration/help/help.module').then(
						(m) => m.HelpPageModule,
					),
			},
		],
	},
	{
		path: 'reset-password',
		loadComponent: () =>
			import('./features/v2/reset-password/reset-password.page').then(
				(m) => m.ResetPasswordPage,
			),
	},
	{
		path: 'registration-closed',
		loadComponent: () =>
			import('./features/registration-closed/registration-closed.page').then(
				(m) => m.RegistrationClosedPage,
			),
	},
	{
		path: 'maintenance',
		loadComponent: () =>
			import('./features/maintenance/maintenance.page').then(
				(m) => m.MaintenancePage,
			),
	},
	{
		path: 'bad-weather',
		loadComponent: () =>
			import('./features/bad-weather/bad-weather.page').then(
				(m) => m.BadWeatherPage,
			),
	},
];
