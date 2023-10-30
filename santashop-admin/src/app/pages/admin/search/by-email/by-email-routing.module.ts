import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ByEmailPage } from './by-email.page';

const routes: Routes = [
	{
		path: '',
		component: ByEmailPage,
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class ByEmailPageRoutingModule {}
