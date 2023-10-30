import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AdminPage } from './admin.page';

const routes: Routes = [
	{
		path: '',
		component: AdminPage,
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
