import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ConfirmDeactivateGuard } from '../../guards/disable-camera.guard';
import { AdminPage } from './admin.page';
import { hasCustomClaim } from '@core/*';
import { AuthGuard, AuthPipe } from '@angular/fire/auth-guard';

const adminOnly = (): AuthPipe => hasCustomClaim('admin');

const routes: Routes = [
	{
		path: '',
		component: AdminPage,
		canActivate: [AuthGuard],
		data: { authGuardPipe: adminOnly },
		children: [
			{
				path: 'scanner',
				loadChildren: () =>
					import('./scanner/scanner.module').then(
						(m) => m.ScannerPageModule
					),
				canDeactivate: [ConfirmDeactivateGuard],
			},
			{
				path: 'search',
				loadChildren: () =>
					import('./search/search.module').then(
						(m) => m.SearchPageModule
					),
			},
			{
				path: 'register',
				loadChildren: () =>
					import('./register/register.module').then(
						(m) => m.RegisterPageModule
					),
			},
			{
				path: 'stats',
				loadChildren: () =>
					import('./stats/stats.module').then(
						(m) => m.StatsPageModule
					),
			},
			{
				path: '',
				redirectTo: '/admin/stats',
				pathMatch: 'full',
			},
		],
	},
	{
		path: '',
		redirectTo: '/admin/stats',
		pathMatch: 'full',
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class AdminPageRoutingModule {}
