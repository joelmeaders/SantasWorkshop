import { NgModule } from '@angular/core';
import { SignInPageRoutingModule } from './sign-in-routing.module';
import { SignInPage } from './sign-in.page';
import { CoreModule } from '@core/*';
import { RecaptchaModule } from 'ng-recaptcha';

@NgModule({
	imports: [CoreModule, SignInPageRoutingModule, RecaptchaModule],
	declarations: [SignInPage],
})
export class SignInPageModule {}
