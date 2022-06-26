import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ChildrenPage } from './children.page';

const routes: Routes = [
	{
		path: '',
		component: ChildrenPage,
	},
	{
		path: 'add-child',
		loadChildren: () =>
			import('./add-child/add-child.module').then(
				(m) => m.AddChildPageModule
			),
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class ChildrenPageRoutingModule {}
