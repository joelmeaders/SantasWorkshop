import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard, AuthPipe } from '@angular/fire/auth-guard';
import { redirectLoggedInTo, hasCustomClaim } from '@santashop/core';

const adminOnly = (): AuthPipe => hasCustomClaim('admin');
const redirectLoggedInToAdmin = (): AuthPipe => redirectLoggedInTo(['admin']);

export const routes: Routes = [
	{
		path: '',
		title: 'DSCS Sign In',
		data: { authGuardPipe: redirectLoggedInToAdmin },
		loadChildren: () =>
			import('./pages/sign-in/sign-in.module').then(
				(m) => m.SignInPageModule,
			),
	},
	{
		path: 'admin',
		title: 'DSCS Home',
		canActivate: [AuthGuard],
		data: { authGuardPipe: adminOnly },
		loadChildren: () =>
			import('./pages/admin/admin.module').then((m) => m.AdminPageModule),
	},
];
@NgModule({
	imports: [
		RouterModule.forRoot(routes, {
			onSameUrlNavigation: 'reload',
		}),
	],
	exports: [RouterModule],
})
export class AppRoutingModule {}
