import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { ResendEmailPageRoutingModule } from './resend-email-routing.module';

import { ResendEmailPage } from './resend-email.page';

@NgModule({
	imports: [
		CommonModule,
		ReactiveFormsModule,

		ResendEmailPageRoutingModule,
		ResendEmailPage,
	],
})
export class ResendEmailPageModule {}
