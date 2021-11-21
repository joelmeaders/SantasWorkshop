import { NgModule } from '@angular/core';
import { AngularFireAuthGuard, hasCustomClaim } from '@angular/fire/compat/auth-guard';
import { RouterModule, Routes } from '@angular/router';
import { AdminPage } from './admin.page';

const adminOnly = () => hasCustomClaim('admin');


const routes: Routes = [
  {
    path: '',
    component: AdminPage,
    canActivate: [AngularFireAuthGuard],
    data: { authGuardPipe: adminOnly },
    children: [
      {
        path: 'scanner',
        loadChildren: () => import('./scanner/scanner.module').then(m => m.ScannerPageModule)
      },
      {
        path: 'search',
        loadChildren: () => import('./search/search.module').then(m => m.SearchPageModule)
      },
      {
        path: 'register',
        loadChildren: () => import('./register/register.module').then(m => m.RegisterPageModule)
      },
      // {
      //   path: 'stats',
      //   loadChildren: () => import('./stats/stats.module').then(m => m.StatsPageModule)
      // },
      // {
      //   path: 'test',
      //   loadChildren: () => import('./test/test.module').then( m => m.TestPageModule)
      // },
      {
        path: '',
        redirectTo: '/admin/register',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: '/admin/register',
    pathMatch: 'full'
  }

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminPageRoutingModule {}
