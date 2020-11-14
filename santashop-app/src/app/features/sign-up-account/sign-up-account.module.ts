import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SignUpAccountPageRoutingModule } from './sign-up-account-routing.module';
import { SignUpAccountPage } from './sign-up-account.page';
import { SharedModule } from '@app/shared/components/shared.module';
import { CoreDirectivesModule } from '@app/core/directives/core-directives.module';

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
