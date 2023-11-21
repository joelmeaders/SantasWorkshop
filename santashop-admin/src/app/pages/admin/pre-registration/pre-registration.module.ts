import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PreRegistrationPageRoutingModule } from './pre-registration-routing.module';

import { PreRegistrationPage } from './pre-registration.page';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    PreRegistrationPageRoutingModule,
    SharedModule,
  ],
  declarations: [PreRegistrationPage]
})
export class PreRegistrationPageModule {}
