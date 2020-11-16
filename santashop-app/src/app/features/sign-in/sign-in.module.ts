import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '@app/shared/components/shared.module';
import { IonicModule } from '@ionic/angular';
import { SignInPageRoutingModule } from './sign-in-routing.module';
import { SignInPage } from './sign-in.page';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    SignInPageRoutingModule,
    SharedModule
  ],
  declarations: [SignInPage]
})
export class SignInPageModule {}
