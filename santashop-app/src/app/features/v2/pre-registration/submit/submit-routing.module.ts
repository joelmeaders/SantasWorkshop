import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SubmitPage } from './submit.page';

const routes: Routes = [
  {
    path: '',
    component: SubmitPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SubmitPageRoutingModule {}
