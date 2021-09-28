import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AngularFireAuthGuard, redirectUnauthorizedTo, redirectLoggedInTo } from '@angular/fire/compat/auth-guard';

const redirectUnauthorizedToLogin = () => redirectUnauthorizedTo(['sign-in']);
const redirectLoggedInToRegistration = () => redirectLoggedInTo(['/pre-registration/overview']);

const routes: Routes = [
  {
    path: '',
    // loadChildren: () => import('./home/home.module').then((m) => m.HomePageModule),
    pathMatch: 'full',
    redirectTo: '/sign-up'
  },
  // {
  //   path: 'profile',
  //   loadChildren: () => import('./features/profile/profile.module').then((m) => m.ProfilePageModule),
  //   canLoad: [AuthGuard],
  //   canActivate: [AuthGuard]
  // },
  // {
  //   path: 'sign-in',
  //   loadChildren: () => import('./features/sign-in/sign-in.module').then((m) => m.SignInPageModule),
  // },
  // {
  //   path: 'sign-up-account',
  //   loadChildren: () => import('./features/sign-up-account/sign-up-account.module').then( m => m.SignUpAccountPageModule),
  //   canLoad: [SignUpStatusGuard],
  //   canActivate: [SignUpStatusGuard]
  // },
  // {
  //   path: 'sign-up-info',
  //   loadChildren: () => import('./features/sign-up-info/sign-up-info.module').then( m => m.SignUpInfoPageModule),
  //   canActivate: [AuthGuard, SignUpStatusGuard],
  // },
  // {
  //   path: 'maintenance',
  //   loadChildren: () => import('./features/maintenance/maintenance.module').then( m => m.MaintenancePageModule)
  // },
  // {
  //   path: 'registration-closed',
  //   loadChildren: () => import('./features/registration-closed/registration-closed.module').then( m => m.RegistrationClosedPageModule)
  // },
  {
    path: 'sign-in',
    loadChildren: () => import('./features/v2/sign-in/sign-in.module').then( m => m.SignInPageModule)
  },
  {
    path: 'sign-up',
    loadChildren: () => import('./features/v2/sign-up/sign-up.module').then( m => m.SignUpPageModule),
    canActivate: [AngularFireAuthGuard],
    data: { authGuardPipe: redirectLoggedInToRegistration }
  },
  {
    path: 'pre-registration',
    loadChildren: () => import('./features/v2/pre-registration/pre-registration.module').then( m => m.PreRegistrationPageModule),
    canActivate: [AngularFireAuthGuard],
    data: { authGuardPipe: redirectUnauthorizedToLogin }
  },  {
    path: 'profile',
    loadChildren: () => import('./features/v2/profile/profile.module').then( m => m.ProfilePageModule)
  },
  {
    path: 'reset-password',
    loadChildren: () => import('./features/v2/reset-password/reset-password.module').then( m => m.ResetPasswordPageModule)
  }

];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules, anchorScrolling: 'enabled', onSameUrlNavigation: 'reload' }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
