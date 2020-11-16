import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '@app/shared/components/shared.module';
import { IonicModule } from '@ionic/angular';
import { SignUpInfoPageRoutingModule } from './sign-up-info-routing.module';
import { SignUpInfoPage } from './sign-up-info.page';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    SignUpInfoPageRoutingModule,
    SharedModule,
  ],
  declarations: [SignUpInfoPage]
})
export class SignUpInfoPageModule {}
