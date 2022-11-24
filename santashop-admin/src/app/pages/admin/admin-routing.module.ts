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
						(m) => m.LandingPageModule
					),
			},
			{
				path: 'checkin',
				loadChildren: () =>
					import('./checkin/checkin.module').then(
						(m) => m.CheckinPageModule
					),
			},
			{
				path: 'search',
				loadChildren: () =>
					import('./search/search.module').then(
						(m) => m.SearchPageModule
					),
			},
			{
				path: 'registration',
				loadChildren: () =>
					import('./registration/registration.module').then(
						(m) => m.RegistrationPageModule
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
						(m) => m.RegistrationPageModule
					),
			},
			{
				path: 'check-in',
				loadChildren: () =>
					import('./stats/check-in/check-in.module').then(
						(m) => m.CheckInPageModule
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
