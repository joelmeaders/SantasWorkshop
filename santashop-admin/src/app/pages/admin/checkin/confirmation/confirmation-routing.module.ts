import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';



const routes: Routes = [
	{
		path: '',
		loadComponent: () => import('./confirmation.page').then(m => m.ConfirmationPage),
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class ConfirmationPageRoutingModule {}
