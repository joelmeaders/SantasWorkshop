import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '@app/core/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./home/home.module').then((m) => m.HomePageModule),
    pathMatch: 'full',
  },
  {
    path: 'profile',
    loadChildren: () => import('./features/profile/profile.module').then((m) => m.ProfilePageModule),
    canLoad: [AuthGuard],
  },
  {
    path: 'sign-in',
    loadChildren: () => import('./features/sign-in/sign-in.module').then((m) => m.SignInPageModule),
  },
  // {
  //   path: 'admin',
  //   loadChildren: () => import('./features/admin/admin-routing.module').then((m) => m.AdminRoutingModule),
  // },
  {
    path: 'sign-up-account',
    loadChildren: () => import('./features/sign-up-account/sign-up-account.module').then( m => m.SignUpAccountPageModule)
  },
  {
    path: 'sign-up-info',
    loadChildren: () => import('./features/sign-up-info/sign-up-info.module').then( m => m.SignUpInfoPageModule)
  },

];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules, anchorScrolling: 'enabled', onSameUrlNavigation: 'reload' }),
  ],
  exports: [RouterModule],
  providers: [AuthGuard],
})
export class AppRoutingModule {}
