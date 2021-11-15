import { NgModule } from '@angular/core';
import { ConfirmationPageRoutingModule } from './confirmation-routing.module';
import { ConfirmationPage } from './confirmation.page';
import { CoreModule } from '@core/*';
import { SharedModule } from '../../../../shared/components/shared.module';

@NgModule({
  imports: [
    CoreModule,
    SharedModule,
    ConfirmationPageRoutingModule
  ],
  declarations: [ConfirmationPage]
})
export class ConfirmationPageModule {}
