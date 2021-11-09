import { NgModule } from '@angular/core';
import { ChangeEmailPageRoutingModule } from './change-email-routing.module';
import { ChangeEmailPage } from './change-email.page';
import { SharedModule } from 'santashop-app/src/app/shared/components/shared.module';
import { CoreModule } from '@core/*';

@NgModule({
  imports: [
    CoreModule,
    SharedModule,
    ChangeEmailPageRoutingModule
  ],
  declarations: [ChangeEmailPage]
})
export class ChangeEmailPageModule {}
