import { NgModule } from '@angular/core';
import { CoreModule, SkeletonStateService } from '@santashop/core';

import { PreRegistrationPageRoutingModule } from './pre-registration-routing.module';
import { PreRegistrationPage } from './pre-registration.page';

@NgModule({
    imports: [CoreModule, PreRegistrationPageRoutingModule, PreRegistrationPage],
    providers: [SkeletonStateService],
})
export class PreRegistrationPageModule {}
