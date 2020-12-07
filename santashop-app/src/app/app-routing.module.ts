import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { SignUpStatusGuard } from './guards/sign-up-status.guard';

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
    canActivate: [AuthGuard, SignUpStatusGuard]
  },
  {
    path: 'sign-in',
    loadChildren: () => import('./features/sign-in/sign-in.module').then((m) => m.SignInPageModule),
  },
  {
    path: 'sign-up-account',
    loadChildren: () => import('./features/sign-up-account/sign-up-account.module').then( m => m.SignUpAccountPageModule),
    canLoad: [SignUpStatusGuard],
    canActivate: [SignUpStatusGuard]
  },
  {
    path: 'sign-up-info',
    loadChildren: () => import('./features/sign-up-info/sign-up-info.module').then( m => m.SignUpInfoPageModule),
    canActivate: [AuthGuard, SignUpStatusGuard],
  },
  {
    path: 'maintenance',
    loadChildren: () => import('./features/maintenance/maintenance.module').then( m => m.MaintenancePageModule)
  },
  {
    path: 'registration-closed',
    loadChildren: () => import('./features/registration-closed/registration-closed.module').then( m => m.RegistrationClosedPageModule)
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
