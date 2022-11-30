import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { DuplicatePage } from './duplicate.page';

const routes: Routes = [
	{
		path: ':uid',
		component: DuplicatePage,
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class DuplicatePageRoutingModule {}
