import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ResendEmailPage } from './resend-email.page';

const routes: Routes = [
  {
    path: '',
    component: ResendEmailPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ResendEmailPageRoutingModule {}
