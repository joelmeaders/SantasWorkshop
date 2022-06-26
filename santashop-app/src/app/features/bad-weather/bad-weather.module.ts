import { NgModule } from '@angular/core';
import { BadWeatherPageRoutingModule } from './bad-weather-routing.module';
import { BadWeatherPage } from './bad-weather.page';
import { CoreModule } from '@core/*';
import { SharedModule } from '../../shared/components/shared.module';

@NgModule({
  imports: [CoreModule, SharedModule, BadWeatherPageRoutingModule],
  declarations: [BadWeatherPage],
})
export class BadWeatherPageModule {}
