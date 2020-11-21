import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RecaptchaModule, RecaptchaSettings, RECAPTCHA_SETTINGS } from 'ng-recaptcha';
import { CoreDirectivesModule } from 'santashop-core/src/public-api';
import { SharedModule } from '../../shared/components/shared.module';
import { SignUpAccountPageRoutingModule } from './sign-up-account-routing.module';
import { SignUpAccountPage } from './sign-up-account.page';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    SignUpAccountPageRoutingModule,
    SharedModule,
    CoreDirectivesModule,
    RecaptchaModule
  ],
  providers: [
    {
      provide: RECAPTCHA_SETTINGS,
      useValue: { siteKey: '6LeY5ecZAAAAALhmvzhfTcdbzHsYbmHmmk11HbHN' } as RecaptchaSettings
    }
  ],
  declarations: [SignUpAccountPage]
})
export class SignUpAccountPageModule {}
