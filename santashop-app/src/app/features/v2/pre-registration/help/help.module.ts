import { NgModule } from '@angular/core';
import { HelpPageRoutingModule } from './help-routing.module';
import { HelpPage } from './help.page';
import { CoreModule } from '@core/*';
import { SharedModule } from 'santashop-app/src/app/shared/components/shared.module';

@NgModule({
  imports: [CoreModule, SharedModule, HelpPageRoutingModule],
  declarations: [HelpPage],
})
export class HelpPageModule {}
