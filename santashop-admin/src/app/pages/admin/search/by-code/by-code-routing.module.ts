import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ByCodePage } from './by-code.page';

const routes: Routes = [
	{
		path: '',
		component: ByCodePage,
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class ByCodePageRoutingModule {}
