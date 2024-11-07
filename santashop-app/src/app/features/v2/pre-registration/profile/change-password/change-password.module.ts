import { NgModule } from '@angular/core';
import { ChangePasswordPageRoutingModule } from './change-password-routing.module';
import { ChangePasswordPage } from './change-password.page';
import { CoreModule } from '@santashop/core';


@NgModule({
    imports: [CoreModule, ChangePasswordPageRoutingModule, ChangePasswordPage],
})
export class ChangePasswordPageModule {}
