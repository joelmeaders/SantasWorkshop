import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { EventInformationPage } from './event-information.page';

const routes: Routes = [
  {
    path: '',
    component: EventInformationPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EventInformationPageRoutingModule {}
