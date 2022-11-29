import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

const routes: Routes = [
	{
		path: '',
		redirectTo: 'scan',
		pathMatch: 'full',
	},
	{
		path: 'scan',
		loadChildren: () =>
			import('./scan/scan.module').then((m) => m.ScanPageModule),
	},
	{
		path: 'review',
		loadChildren: () =>
			import('./review/review.module').then((m) => m.ReviewPageModule),
	},
	{
		path: 'confirmation',
		loadChildren: () =>
			import('./confirmation/confirmation.module').then(
				(m) => m.ConfirmationPageModule
			),
	},  {
    path: 'duplicate',
    loadChildren: () => import('./duplicate/duplicate.module').then( m => m.DuplicatePageModule)
  },

];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class CheckinPageRoutingModule {}
