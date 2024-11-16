import { NgModule } from '@angular/core';
import { ConfirmationPageRoutingModule } from './confirmation-routing.module';
import { ConfirmationPage } from './confirmation.page';
import { CoreModule } from '@santashop/core';

@NgModule({
	imports: [CoreModule, ConfirmationPageRoutingModule, ConfirmationPage],
})
export class ConfirmationPageModule {}
