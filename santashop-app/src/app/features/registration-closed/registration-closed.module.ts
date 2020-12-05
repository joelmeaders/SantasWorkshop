import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { RegistrationClosedPageRoutingModule } from './registration-closed-routing.module';

import { RegistrationClosedPage } from './registration-closed.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RegistrationClosedPageRoutingModule
  ],
  declarations: [RegistrationClosedPage]
})
export class RegistrationClosedPageModule {}
