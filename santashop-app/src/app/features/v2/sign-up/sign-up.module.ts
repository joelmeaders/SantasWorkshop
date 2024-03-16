import { NgModule } from '@angular/core';
import { SignUpPageRoutingModule } from './sign-up-routing.module';
import { SignUpPage } from './sign-up.page';
import { CoreModule } from '@santashop/core';

@NgModule({
	imports: [CoreModule, SignUpPageRoutingModule],
	declarations: [SignUpPage],
})
export class SignUpPageModule {}
