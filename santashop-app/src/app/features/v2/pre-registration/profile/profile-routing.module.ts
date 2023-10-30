import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ProfilePage } from './profile.page';

const routes: Routes = [
	{
		path: '',
		component: ProfilePage,
	},
	{
		path: 'change-info',
		loadChildren: () =>
			import('./change-info/change-info.module').then(
				(m) => m.ChangeInfoPageModule,
			),
	},
	{
		path: 'change-email',
		loadChildren: () =>
			import('./change-email/change-email.module').then(
				(m) => m.ChangeEmailPageModule,
			),
	},
	{
		path: 'change-password',
		loadChildren: () =>
			import('./change-password/change-password.module').then(
				(m) => m.ChangePasswordPageModule,
			),
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class ProfilePageRoutingModule {}
