import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from 'santashop-app/src/app/core/guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./features/sign-in/sign-in.module').then(m => m.SignInPageModule),
    pathMatch: 'full'
  },
  {
    path: 'admin',
    canLoad: [AuthGuard],
    canActivate: [AdminGuard],
    loadChildren: () => import('./features/admin/admin.module').then(m => m.AdminPageModule),
  }
];
@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
