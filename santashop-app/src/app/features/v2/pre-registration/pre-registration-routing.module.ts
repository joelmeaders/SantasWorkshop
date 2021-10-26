import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { RegistrationCompleteGuard } from '../../../core/guards/registration-complete.guard';

import { PreRegistrationPage } from './pre-registration.page';

const routes: Routes = [
  {
    // Main page, status, info, etc...
    path: '',
    component: PreRegistrationPage,
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
      }
    ]
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PreRegistrationPageRoutingModule {}
