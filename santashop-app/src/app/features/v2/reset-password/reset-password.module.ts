import { NgModule } from '@angular/core';
import { ResetPasswordPageRoutingModule } from './reset-password-routing.module';
import { ResetPasswordPage } from './reset-password.page';
import { CoreModule } from '@santashop/core';

@NgModule({
	imports: [CoreModule, ResetPasswordPageRoutingModule],
	declarations: [ResetPasswordPage],
})
export class ResetPasswordPageModule {}
