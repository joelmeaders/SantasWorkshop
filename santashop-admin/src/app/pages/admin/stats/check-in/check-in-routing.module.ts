import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CheckInPage } from './check-in.page';

const routes: Routes = [
  {
    path: '',
    component: CheckInPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CheckInPageRoutingModule {}
