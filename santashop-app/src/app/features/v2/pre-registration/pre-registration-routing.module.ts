import { NgModule } from '@angular/core';
import { AuthGuard, AuthPipe } from '@angular/fire/auth-guard';
import { Routes, RouterModule } from '@angular/router';
import { RegistrationCompleteGuard } from '../../../core/guards/registration-complete.guard';
import { PreRegistrationPage } from './pre-registration.page';
import { redirectUnauthorizedTo } from '@core/*';
import { CheckedInGuard } from '../../../core/guards/checked-in.guard';
import { RegistrationReadyToSubmitGuard } from '../../../core/guards/registration-ready-to-submit.guard';
import { RegistrationIncompleteGuard } from '../../../core/guards/registration-incomplete.guard';

const redirectUnauthorizedToLogin = (): AuthPipe =>
	redirectUnauthorizedTo(['/sign-in']);

const routes: Routes = [
	{
		// Main page, status, info, etc...
		path: '',
		component: PreRegistrationPage,
		canActivate: [AuthGuard],
		canActivateChild: [CheckedInGuard],
		data: { authGuardPipe: redirectUnauthorizedToLogin },
		children: [
			{
				// Additional information such as zip, etc...
				path: 'overview',
				canActivateChild: [RegistrationCompleteGuard],
				loadChildren: () =>
					import('./overview/overview.module').then(
						(m) => m.InformationPageModule
					),
			},
			{
				// Manage children
				path: 'children',
				canActivateChild: [RegistrationCompleteGuard],
				loadChildren: () =>
					import('./children/children.module').then(
						(m) => m.ChildrenPageModule
					),
			},
			{
				// Choose date and time
				path: 'date-time',
				canActivateChild: [RegistrationCompleteGuard],
				loadChildren: () =>
					import('./date-time/date-time.module').then(
						(m) => m.DateTimePageModule
					),
			},
			{
				// Submit
				path: 'submit',
				canActivateChild: [
					RegistrationReadyToSubmitGuard,
					RegistrationCompleteGuard,
				],
				loadChildren: () =>
					import('./submit/submit.module').then(
						(m) => m.SubmitPageModule
					),
			},
			{
				// QR Code and event information
				path: 'confirmation',
				canActivateChild: [RegistrationIncompleteGuard],
				loadChildren: () =>
					import('./confirmation/confirmation.module').then(
						(m) => m.ConfirmationPageModule
					),
			},
			{
				// My account
				path: 'profile',
				loadChildren: () =>
					import('./profile/profile.module').then(
						(m) => m.ProfilePageModule
					),
			},
			{
				path: 'help',
				loadChildren: () =>
					import('./help/help.module').then((m) => m.HelpPageModule),
			},
		],
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class PreRegistrationPageRoutingModule {}
