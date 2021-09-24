import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

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
        loadChildren: () => import('./overview/overview.module').then( m => m.InformationPageModule)
      },
      {
        // Manage children
        path: 'children',
        loadChildren: () => import('./children/children.module').then( m => m.ChildrenPageModule)
      },
      {
        // Choose date and time
        path: 'date-time',
        loadChildren: () => import('./date-time/date-time.module').then( m => m.DateTimePageModule)
      },
      {
        // QR Code and event information
        path: 'confirmation',
        loadChildren: () => import('./confirmation/confirmation.module').then( m => m.ConfirmationPageModule)
      },
      {
        path: 'submit',
        loadChildren: () => import('./submit/submit.module').then( m => m.SubmitPageModule)
      },
    ]
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PreRegistrationPageRoutingModule {}
