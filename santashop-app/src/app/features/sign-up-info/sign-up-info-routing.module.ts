import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SignUpInfoPage } from './sign-up-info.page';

const routes: Routes = [
  {
    path: '',
    component: SignUpInfoPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SignUpInfoPageRoutingModule {}
