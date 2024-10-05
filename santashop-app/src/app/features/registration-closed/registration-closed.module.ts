import { NgModule } from '@angular/core';
import { RegistrationClosedPageRoutingModule } from './registration-closed-routing.module';
import { RegistrationClosedPage } from './registration-closed.page';
import { CoreModule } from '@santashop/core';


@NgModule({
    imports: [CoreModule, RegistrationClosedPageRoutingModule, RegistrationClosedPage],
})
export class RegistrationClosedPageModule {}
