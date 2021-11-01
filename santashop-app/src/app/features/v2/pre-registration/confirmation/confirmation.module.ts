import { NgModule } from '@angular/core';
import { ConfirmationPageRoutingModule } from './confirmation-routing.module';
import { ConfirmationPage } from './confirmation.page';
import { CoreModule } from '@core/*';

@NgModule({
  imports: [
    CoreModule,
    ConfirmationPageRoutingModule
  ],
  declarations: [ConfirmationPage]
})
export class ConfirmationPageModule {}
