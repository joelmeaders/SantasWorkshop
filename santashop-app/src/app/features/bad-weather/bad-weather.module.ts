import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { BadWeatherPageRoutingModule } from './bad-weather-routing.module';

import { BadWeatherPage } from './bad-weather.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BadWeatherPageRoutingModule
  ],
  declarations: [BadWeatherPage]
})
export class BadWeatherPageModule {}
