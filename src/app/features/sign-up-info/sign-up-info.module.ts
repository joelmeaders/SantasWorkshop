import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SignUpInfoPageRoutingModule } from './sign-up-info-routing.module';

import { SignUpInfoPage } from './sign-up-info.page';
import { SharedModule } from '@app/shared/components/shared.module';
import { CoreDirectivesModule } from '@app/core/directives/core-directives.module';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    SignUpInfoPageRoutingModule,
    SharedModule,
    CoreDirectivesModule
  ],
  declarations: [SignUpInfoPage]
})
export class SignUpInfoPageModule {}
