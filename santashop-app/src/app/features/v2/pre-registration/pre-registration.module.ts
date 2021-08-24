import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../../shared/components/shared.module';
import { PreRegistrationPageRoutingModule } from './pre-registration-routing.module';
import { PreRegistrationPage } from './pre-registration.page';

@NgModule({
  imports: [
    IonicModule,
    SharedModule,
    PreRegistrationPageRoutingModule
  ],
  declarations: [PreRegistrationPage],
})
export class PreRegistrationPageModule {}
