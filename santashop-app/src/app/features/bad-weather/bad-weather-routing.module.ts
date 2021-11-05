import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { BadWeatherPage } from './bad-weather.page';

const routes: Routes = [
  {
    path: '',
    component: BadWeatherPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BadWeatherPageRoutingModule {}
