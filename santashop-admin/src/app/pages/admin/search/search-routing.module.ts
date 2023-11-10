import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SearchPage } from './search.page';

const routes: Routes = [
	{
		path: '',
		component: SearchPage,
	},
	{
		path: 'by-name',
		title: 'DSCS: Search By Name',

		loadChildren: () =>
			import('./by-name/by-name.module').then((m) => m.ByNamePageModule),
	},
	{
		path: 'by-email',
		title: 'DSCS: Search By Email',
		loadChildren: () =>
			import('./by-email/by-email.module').then(
				(m) => m.ByEmailPageModule,
			),
	},
	{
		path: 'by-code',
		title: 'DSCS: Search By Code',
		loadChildren: () =>
			import('./by-code/by-code.module').then((m) => m.ByCodePageModule),
	},
	{
		path: 'results',
		title: 'DSCS: Search Results',
		loadChildren: () =>
			import('./results/results.module').then((m) => m.ResultsPageModule),
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class SearchPageRoutingModule {}
