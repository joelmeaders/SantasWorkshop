import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { QuickRegistrationPage } from './quick-registration.page';

const routes: Routes = [
  {
    path: '',
    component: QuickRegistrationPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class QuickRegistrationPageRoutingModule {}
