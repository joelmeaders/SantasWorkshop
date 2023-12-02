import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ResendEmailPageRoutingModule } from './resend-email-routing.module';

import { ResendEmailPage } from './resend-email.page';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    ResendEmailPageRoutingModule,
    SharedModule
  ],
  declarations: [ResendEmailPage]
})
export class ResendEmailPageModule {}
