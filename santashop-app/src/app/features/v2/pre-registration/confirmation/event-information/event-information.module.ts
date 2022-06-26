import { NgModule } from '@angular/core';
import { EventInformationPageRoutingModule } from './event-information-routing.module';
import { EventInformationPage } from './event-information.page';
import { CoreModule } from '@core/*';
import { SharedModule } from 'santashop-app/src/app/shared/components/shared.module';

@NgModule({
  imports: [CoreModule, SharedModule, EventInformationPageRoutingModule],
  declarations: [EventInformationPage],
})
export class EventInformationPageModule {}
