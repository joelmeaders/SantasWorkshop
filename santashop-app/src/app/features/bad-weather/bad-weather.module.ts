import { NgModule } from '@angular/core';
import { BadWeatherPageRoutingModule } from './bad-weather-routing.module';
import { BadWeatherPage } from './bad-weather.page';
import { CoreModule } from '@santashop/core';


@NgModule({
    imports: [CoreModule, BadWeatherPageRoutingModule, BadWeatherPage],
})
export class BadWeatherPageModule {}
