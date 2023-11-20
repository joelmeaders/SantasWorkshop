import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PreRegistrationPageRoutingModule } from './pre-registration-routing.module';

import { PreRegistrationPage } from './pre-registration.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PreRegistrationPageRoutingModule
  ],
  declarations: [PreRegistrationPage]
})
export class PreRegistrationPageModule {}
