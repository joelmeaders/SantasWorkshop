import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { RegistrationClosedPage } from './registration-closed.page';

const routes: Routes = [
	{
		path: '',
		component: RegistrationClosedPage,
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class RegistrationClosedPageRoutingModule {}
