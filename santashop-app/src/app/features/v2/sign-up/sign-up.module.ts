import { NgModule } from '@angular/core';
import { SignUpPageRoutingModule } from './sign-up-routing.module';
import { SignUpPage } from './sign-up.page';
import { CoreModule } from 'santashop-core/src/public-api';
import { RecaptchaModule } from 'ng-recaptcha';

@NgModule({
	imports: [CoreModule, SignUpPageRoutingModule, RecaptchaModule],
	declarations: [SignUpPage],
})
export class SignUpPageModule {}
