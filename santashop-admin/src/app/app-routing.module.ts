import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard, AuthPipe } from '@angular/fire/auth-guard';
import { redirectLoggedInTo, hasCustomClaim } from '@core/*';

const adminOnly = (): AuthPipe => hasCustomClaim('admin');
const redirectLoggedInToAdmin = (): AuthPipe => redirectLoggedInTo(['admin']);

const routes: Routes = [
	{
		path: '',
		canActivate: [AuthGuard],
		data: { authGuardPipe: redirectLoggedInToAdmin },
		loadChildren: () =>
			import('./pages/sign-in/sign-in.module').then(
				(m) => m.SignInPageModule
			),
	},
	{
		path: 'admin',
		canActivate: [AuthGuard],
		data: { authGuardPipe: adminOnly },
		loadChildren: () =>
			import('./pages/admin/admin.module').then((m) => m.AdminPageModule),
	},
];
@NgModule({
	imports: [
		RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
	],
	exports: [RouterModule],
})
export class AppRoutingModule {}
