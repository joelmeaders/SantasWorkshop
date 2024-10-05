import { NgModule } from '@angular/core';
import { ChangeEmailPageRoutingModule } from './change-email-routing.module';
import { ChangeEmailPage } from './change-email.page';

import { CoreModule } from '@santashop/core';

@NgModule({
    imports: [CoreModule, ChangeEmailPageRoutingModule, ChangeEmailPage],
})
export class ChangeEmailPageModule {}
