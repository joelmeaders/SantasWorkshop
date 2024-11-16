import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';



const routes: Routes = [
	{
		path: '',
		loadComponent: () => import('./scan.page').then(m => m.ScanPage),
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class ScanPageRoutingModule {}
