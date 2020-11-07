import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SignUpPageRoutingModule } from './sign-up-routing.module';

import { SignUpPage } from './sign-up.page';
import { CoreDirectivesModule } from '@app/core/directives/core-directives.module';
import { SharedModule } from '@app/shared/components/shared.module';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    SignUpPageRoutingModule,
    CoreDirectivesModule,
    SharedModule
  ],
  declarations: [
    SignUpPage
  ]
})
export class SignUpPageModule {}
