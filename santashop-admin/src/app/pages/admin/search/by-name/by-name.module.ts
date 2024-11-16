import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ByNamePageRoutingModule } from './by-name-routing.module';

import { ByNamePage } from './by-name.page';

import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
	imports: [
		CommonModule,
		ReactiveFormsModule,

		ByNamePageRoutingModule,
		ByNamePage,
	],
})
export class ByNamePageModule {}
