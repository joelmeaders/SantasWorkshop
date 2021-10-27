import { NgModule } from '@angular/core';
import { InformationPageRoutingModule } from './overview-routing.module';
import { OverviewPage } from './overview.page';
import { CoreModule } from '@core/*';

@NgModule({
  imports: [
    CoreModule,
    InformationPageRoutingModule
  ],
  declarations: [OverviewPage]
})
export class InformationPageModule {}
