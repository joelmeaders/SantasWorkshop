import { NgModule } from '@angular/core';
import { DateTimePageRoutingModule } from './date-time-routing.module';
import { DateTimePage } from './date-time.page';
import { CoreModule } from '@santashop/core';
import { SharedModule } from '../../../../shared/components/shared.module';

@NgModule({
	imports: [CoreModule, SharedModule, DateTimePageRoutingModule],
	declarations: [DateTimePage],
})
export class DateTimePageModule {}
