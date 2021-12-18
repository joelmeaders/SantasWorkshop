import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard, redirectUnauthorizedTo, redirectLoggedInTo } from '@angular/fire/auth-guard';

const redirectUnauthorizedToLogin = () => redirectUnauthorizedTo(['/sign-in']);
const redirectLoggedInToRegistration = () => redirectLoggedInTo(['/pre-registration/overview']);

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./home/home.module').then((m) => m.HomePageModule),
    pathMatch: 'full',
  },
  {
    path: 'sign-in',
    loadChildren: () => import('./features/v2/sign-in/sign-in.module').then( m => m.SignInPageModule),
    data: { authGuardPipe: redirectLoggedInToRegistration }
  },
  {
    path: 'sign-up',
    loadChildren: () => import('./features/v2/sign-up/sign-up.module').then( m => m.SignUpPageModule),
    canActivate: [AuthGuard],
    data: { authGuardPipe: redirectLoggedInToRegistration }
  },
  {
    path: 'pre-registration',
    loadChildren: () => import('./features/v2/pre-registration/pre-registration.module').then( m => m.PreRegistrationPageModule),
    canActivate: [AuthGuard],
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
  },
  {
    path: 'bad-weather',
    loadChildren: () => import('./features/bad-weather/bad-weather.module').then( m => m.BadWeatherPageModule)
  }

];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules, anchorScrolling: 'enabled', onSameUrlNavigation: 'reload' }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
