import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';



const routes: Routes = [
	{
		path: '',
		loadComponent: () => import('./sign-in.page').then(m => m.SignInPage),
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class SignInPageRoutingModule {}
