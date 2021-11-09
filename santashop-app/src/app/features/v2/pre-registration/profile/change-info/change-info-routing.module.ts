import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ChangeInfoPage } from './change-info.page';

const routes: Routes = [
  {
    path: '',
    component: ChangeInfoPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ChangeInfoPageRoutingModule {}
