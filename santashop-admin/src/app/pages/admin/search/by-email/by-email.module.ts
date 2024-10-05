import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ByEmailPageRoutingModule } from './by-email-routing.module';

import { ByEmailPage } from './by-email.page';

import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
	imports: [
		CommonModule,

		ReactiveFormsModule,
		ByEmailPageRoutingModule,
		ByEmailPage,
	],
})
export class ByEmailPageModule {}
