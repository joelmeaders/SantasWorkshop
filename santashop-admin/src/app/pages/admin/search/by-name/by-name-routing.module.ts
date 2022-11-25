import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ByNamePage } from './by-name.page';

const routes: Routes = [
  {
    path: '',
    component: ByNamePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ByNamePageRoutingModule {}
