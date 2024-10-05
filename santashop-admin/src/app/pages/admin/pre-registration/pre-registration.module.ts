import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { PreRegistrationPageRoutingModule } from './pre-registration-routing.module';

import { PreRegistrationPage } from './pre-registration.page';

@NgModule({
	imports: [
		CommonModule,
		ReactiveFormsModule,

		PreRegistrationPageRoutingModule,
		PreRegistrationPage,
	],
})
export class PreRegistrationPageModule {}
