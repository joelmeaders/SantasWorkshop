import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ByCodePageRoutingModule } from './by-code-routing.module';

import { ByCodePage } from './by-code.page';

import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
	imports: [
		CommonModule,

		ReactiveFormsModule,
		ByCodePageRoutingModule,
		ByCodePage,
	],
})
export class ByCodePageModule {}
