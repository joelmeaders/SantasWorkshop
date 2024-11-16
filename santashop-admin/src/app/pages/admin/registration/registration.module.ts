import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { RegistrationPageRoutingModule } from './registration-routing.module';

import { RegistrationPage } from './registration.page';

import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
	imports: [
		CommonModule,

		RegistrationPageRoutingModule,
		ReactiveFormsModule,
		RegistrationPage,
	],
})
export class RegistrationPageModule {}
