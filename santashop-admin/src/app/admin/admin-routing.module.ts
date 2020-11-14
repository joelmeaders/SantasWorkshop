import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'quick-registration',
        loadChildren: () =>
          import('./quick-registration/quick-registration.module')
            .then(m => m.QuickRegistrationPageModule)
      },
      {
        path: 'scanner',
        loadChildren: () => import('./scanner/scanner.module').then( m => m.ScannerPageModule)
      },
      {
        path: 'check-in',
        loadChildren: () => import('./check-in/check-in.module').then( m => m.CheckInPageModule)
      }
    ]
  },
  
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
