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
		title: 'DSCS: Scan Registration Codes',
		loadChildren: () =>
			import('./scan/scan.module').then((m) => m.ScanPageModule),
	},
	{
		path: 'review',
		title: 'DSCS: Review Information',
		loadChildren: () =>
			import('./review/review.module').then((m) => m.ReviewPageModule),
	},
	{
		path: 'confirmation',
		title: 'DSCS: Checked In',
		loadChildren: () =>
			import('./confirmation/confirmation.module').then(
				(m) => m.ConfirmationPageModule
			),
	},
	{
		path: 'duplicate',
		title: 'DSCS: Duplicate Check-In',
		loadChildren: () =>
			import('./duplicate/duplicate.module').then(
				(m) => m.DuplicatePageModule
			),
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class CheckinPageRoutingModule {}
