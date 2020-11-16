import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '@app/shared/components/shared.module';
import { IonicModule } from '@ionic/angular';
import { CoreDirectivesModule } from 'santashop-core-lib';
import { SignUpAccountPageRoutingModule } from './sign-up-account-routing.module';
import { SignUpAccountPage } from './sign-up-account.page';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    SignUpAccountPageRoutingModule,
    SharedModule,
    CoreDirectivesModule
  ],
  declarations: [SignUpAccountPage]
})
export class SignUpAccountPageModule {}
