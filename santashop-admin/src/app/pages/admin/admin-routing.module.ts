import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

const routes: Routes = [
	{
		path: '',
		loadComponent: () => import('./admin.page').then((m) => m.AdminPage),
		children: [
			{
				path: 'landing',
				loadChildren: () =>
					import('./landing/landing.module').then(
						(m) => m.LandingPageModule,
					),
			},
			{
				path: 'checkin',
				title: 'DSCS: Check In',
				loadChildren: () =>
					import('./checkin/checkin.module').then(
						(m) => m.CheckinPageModule,
					),
			},
			{
				path: 'search',
				title: 'DSCS: Search',
				loadChildren: () =>
					import('./search/search.module').then(
						(m) => m.SearchPageModule,
					),
			},
			{
				path: 'registration',
				title: 'DSCS: Register',
				loadChildren: () =>
					import('./registration/registration.module').then(
						(m) => m.RegistrationPageModule,
					),
			},
			{
				path: 'pre-registration',
				title: 'DSCS: Pre-Registration',
				loadChildren: () =>
					import('./pre-registration/pre-registration.module').then(
						(m) => m.PreRegistrationPageModule,
					),
			},
			{
				path: 'resend-email',
				title: 'DSCS: Resend Email',
				loadChildren: () =>
					import('./tools/resend-email/resend-email.module').then(
						(m) => m.ResendEmailPageModule,
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
		path: 'stats',
		children: [
			{
				path: 'registration',
				loadChildren: () =>
					import('./stats/registration/registration.module').then(
						(m) => m.RegistrationPageModule,
					),
			},
			{
				path: 'check-in',
				loadChildren: () =>
					import('./stats/check-in/check-in.module').then(
						(m) => m.CheckInPageModule,
					),
			},
			{
				path: 'user',
				loadChildren: () =>
					import('./stats/user/user.module').then(
						(m) => m.UserPageModule,
					),
			},
		],
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class AdminPageRoutingModule {}
