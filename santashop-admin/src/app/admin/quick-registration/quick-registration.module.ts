import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { QuickRegistrationPageRoutingModule } from './quick-registration-routing.module';

import { QuickRegistrationPage } from './quick-registration.page';
// import { CoreDirectivesModule } from '@app/core/directives/core-directives.module';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    QuickRegistrationPageRoutingModule,
    // CoreDirectivesModule
  ],
  declarations: [QuickRegistrationPage]
})
export class QuickRegistrationPageModule {}
