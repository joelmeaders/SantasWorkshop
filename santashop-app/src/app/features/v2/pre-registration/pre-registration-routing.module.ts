import { NgModule } from '@angular/core';
import { AngularFireAuthGuard, redirectUnauthorizedTo } from '@angular/fire/compat/auth-guard';
import { Routes, RouterModule } from '@angular/router';
import { RegistrationCompleteGuard } from '../../../core/guards/registration-complete.guard';
import { PreRegistrationPage } from './pre-registration.page';

const redirectUnauthorizedToLogin = () => redirectUnauthorizedTo(['/sign-in']);

const routes: Routes = [
  {
    // Main page, status, info, etc...
    path: '',
    component: PreRegistrationPage,
    canActivate: [AngularFireAuthGuard],
    data: { authGuardPipe: redirectUnauthorizedToLogin },
    children: [
      {
        // Additional information such as zip, etc...
        path: 'overview',
        loadChildren: () => import('./overview/overview.module').then( m => m.InformationPageModule),
        canActivate: [ RegistrationCompleteGuard ]
      },
      {
        // Manage children
        path: 'children',
        loadChildren: () => import('./children/children.module').then( m => m.ChildrenPageModule),
        canActivate: [ RegistrationCompleteGuard ]
      },
      {
        // Choose date and time
        path: 'date-time',
        loadChildren: () => import('./date-time/date-time.module').then( m => m.DateTimePageModule),
        canActivate: [ RegistrationCompleteGuard ]
      },
      {
        // Submit
        path: 'submit',
        loadChildren: () => import('./submit/submit.module').then( m => m.SubmitPageModule),
        canActivate: [ RegistrationCompleteGuard ]
      },
      {
        // QR Code and event information
        path: 'confirmation',
        loadChildren: () => import('./confirmation/confirmation.module').then( m => m.ConfirmationPageModule)
      },
      {
        // My account
        path: 'profile',
        loadChildren: () => import('./profile/profile.module').then( m => m.ProfilePageModule)
      },
      {
        path: 'help',
        loadChildren: () => import('./help/help.module').then( m => m.HelpPageModule)
      },
    
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PreRegistrationPageRoutingModule {}
