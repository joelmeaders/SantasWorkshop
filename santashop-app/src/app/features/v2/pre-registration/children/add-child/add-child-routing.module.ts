import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AddChildPage } from './add-child.page';

const routes: Routes = [
  {
    path: '',
    component: AddChildPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AddChildPageRoutingModule {}
