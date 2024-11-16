import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';



const routes: Routes = [
	{
		path: ':uid',
		loadComponent: () => import('./duplicate.page').then(m => m.DuplicatePage),
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class DuplicatePageRoutingModule {}
