import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { SignInPageRoutingModule } from './sign-in-routing.module';

import { SignInPage } from './sign-in.page';

@NgModule({
	imports: [
		CommonModule,
		ReactiveFormsModule,

		SignInPageRoutingModule,
		SignInPage,
	],
})
export class SignInPageModule {}
