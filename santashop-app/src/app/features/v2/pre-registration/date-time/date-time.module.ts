import { NgModule } from '@angular/core';
import { DateTimePageRoutingModule } from './date-time-routing.module';
import { DateTimePage } from './date-time.page';
import { CoreModule } from '@core/*';

@NgModule({
  imports: [
    CoreModule,
    DateTimePageRoutingModule
  ],
  declarations: [DateTimePage]
})
export class DateTimePageModule {}
