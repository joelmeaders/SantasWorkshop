import { NgModule } from '@angular/core';
import { ChangePasswordPageRoutingModule } from './change-password-routing.module';
import { ChangePasswordPage } from './change-password.page';
import { CoreModule } from '@core/*';
import { SharedModule } from 'santashop-app/src/app/shared/components/shared.module';

@NgModule({
  imports: [CoreModule, SharedModule, ChangePasswordPageRoutingModule],
  declarations: [ChangePasswordPage],
})
export class ChangePasswordPageModule {}
