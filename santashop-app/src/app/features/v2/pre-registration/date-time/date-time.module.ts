import { NgModule } from '@angular/core';
import { DateTimePageRoutingModule } from './date-time-routing.module';
import { DateTimePage } from './date-time.page';
import { CoreModule } from '@santashop/core';

@NgModule({
	imports: [CoreModule, DateTimePageRoutingModule, DateTimePage],
})
export class DateTimePageModule {}
