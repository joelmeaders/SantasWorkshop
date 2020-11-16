import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SignUpAccountPage } from './sign-up-account.page';

const routes: Routes = [
  {
    path: '',
    component: SignUpAccountPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SignUpAccountPageRoutingModule {}
