import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AdminPage } from './admin.page';

const routes: Routes = [
	{
		path: '',
		component: AdminPage,
		children: [
			{
				path: '',
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
		],
	},
	{
		path: 'stats',
		loadChildren: () =>
			import('./stats/stats.module').then((m) => m.StatsPageModule),
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class AdminPageRoutingModule {}
