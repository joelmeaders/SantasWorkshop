import { NgModule } from '@angular/core';
import { ResetPasswordPageRoutingModule } from './reset-password-routing.module';
import { ResetPasswordPage } from './reset-password.page';
import { CoreModule } from '@core/*';
import { RecaptchaModule } from 'ng-recaptcha';

@NgModule({
  imports: [CoreModule, ResetPasswordPageRoutingModule, RecaptchaModule],
  declarations: [ResetPasswordPage],
})
export class ResetPasswordPageModule {}
