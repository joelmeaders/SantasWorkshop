import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ConfirmationPage } from './confirmation.page';

const routes: Routes = [
	{
		path: '',
		component: ConfirmationPage,
	},
	{
		// Event info, where to go, what to bring
		path: 'event-information',
		loadChildren: () =>
			import('./event-information/event-information.module').then(
				(m) => m.EventInformationPageModule,
			),
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class ConfirmationPageRoutingModule {}
