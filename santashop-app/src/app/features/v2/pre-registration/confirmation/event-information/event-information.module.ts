import { NgModule } from '@angular/core';
import { EventInformationPageRoutingModule } from './event-information-routing.module';
import { EventInformationPage } from './event-information.page';
import { CoreModule } from '@santashop/core';

@NgModule({
	imports: [
		CoreModule,
		EventInformationPageRoutingModule,
		EventInformationPage,
	],
})
export class EventInformationPageModule {}
