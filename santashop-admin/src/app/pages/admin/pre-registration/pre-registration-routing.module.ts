import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PreRegistrationPage } from './pre-registration.page';

const routes: Routes = [
  {
    path: '',
    component: PreRegistrationPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PreRegistrationPageRoutingModule {}
