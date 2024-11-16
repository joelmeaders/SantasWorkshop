import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';



const routes: Routes = [
	{
		path: '',
		loadComponent: () => import('./review.page').then(m => m.ReviewPage),
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class ReviewPageRoutingModule {}
