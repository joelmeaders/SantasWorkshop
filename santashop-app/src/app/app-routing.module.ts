import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AngularFireAuthGuard, redirectUnauthorizedTo, redirectLoggedInTo } from '@angular/fire/compat/auth-guard';

const redirectUnauthorizedToLogin = () => redirectUnauthorizedTo(['sign-in']);
const redirectLoggedInToRegistration = () => redirectLoggedInTo(['/pre-registration/overview']);

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./home/home.module').then((m) => m.HomePageModule),
    pathMatch: 'full',
  },
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
  },
  {
    path: 'reset-password',
    loadChildren: () => import('./features/v2/reset-password/reset-password.module').then( m => m.ResetPasswordPageModule)
  },
  {
    path: 'registration-closed',
    loadChildren: () => import('./features/registration-closed/registration-closed.module').then( m => m.RegistrationClosedPageModule)
  },
  {
    path: 'maintenance',
    loadChildren: () => import('./features/maintenance/maintenance.module').then( m => m.MaintenancePageModule)
  }

];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules, anchorScrolling: 'enabled', onSameUrlNavigation: 'reload' }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
