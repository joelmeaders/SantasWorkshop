import { NgModule } from '@angular/core';
import { CoreModule, SkeletonStateService } from '@core/*';
import { SharedModule } from '../../../shared/components/shared.module';
import { PreRegistrationPageRoutingModule } from './pre-registration-routing.module';
import { PreRegistrationPage } from './pre-registration.page';

@NgModule({
  imports: [
    CoreModule,
    SharedModule,
    PreRegistrationPageRoutingModule
  ],
  declarations: [PreRegistrationPage],
  providers: [
    SkeletonStateService
  ]
})
export class PreRegistrationPageModule {}
