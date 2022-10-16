import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import {
	redirectLoggedInTo,
	hasCustomClaim,
	AuthGuard,
} from '@angular/fire/auth-guard';

const adminOnly = () => hasCustomClaim('admin');
const redirectLoggedInToItems = () => redirectLoggedInTo(['admin']);

const routes: Routes = [
	{
		path: '',
		canActivate: [AuthGuard],
		data: { authGuardPipe: redirectLoggedInToItems },
		loadChildren: () =>
			import('./features/sign-in/sign-in.module').then(
				(m) => m.SignInPageModule
			),
		pathMatch: 'full',
	},
	{
		path: 'admin',
		canActivate: [AuthGuard],
		data: { authGuardPipe: adminOnly },
		loadChildren: () =>
			import('./features/admin/admin.module').then(
				(m) => m.AdminPageModule
			),
	},
];
@NgModule({
	imports: [
		RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
	],
	exports: [RouterModule],
})
export class AppRoutingModule {}
