import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { RegistrationPageRoutingModule } from './registration-routing.module';

import { RegistrationPage } from './registration.page';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
	imports: [
		CommonModule,
		IonicModule,
		RegistrationPageRoutingModule,
		SharedModule,
	],
	declarations: [RegistrationPage],
})
export class RegistrationPageModule {}
