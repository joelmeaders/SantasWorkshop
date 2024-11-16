import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

const routes: Routes = [
	{
		path: '',
		loadComponent: () =>
			import('./pre-registration.page').then(
				(m) => m.PreRegistrationPage,
			),
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class PreRegistrationPageRoutingModule {}
