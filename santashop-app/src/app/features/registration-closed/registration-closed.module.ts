import { NgModule } from '@angular/core';
import { RegistrationClosedPageRoutingModule } from './registration-closed-routing.module';
import { RegistrationClosedPage } from './registration-closed.page';
import { CoreModule } from 'santashop-core/src/public-api';
import { SharedModule } from '../../shared/components/shared.module';

@NgModule({
	imports: [CoreModule, SharedModule, RegistrationClosedPageRoutingModule],
	declarations: [RegistrationClosedPage],
})
export class RegistrationClosedPageModule {}
