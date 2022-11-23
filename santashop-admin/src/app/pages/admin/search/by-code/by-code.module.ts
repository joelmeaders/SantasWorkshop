import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { ByCodePageRoutingModule } from './by-code-routing.module';

import { ByCodePage } from './by-code.page';
import { SharedModule } from '../../../../shared/shared.module';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
	imports: [
		CommonModule,
		IonicModule,
		ReactiveFormsModule,
		ByCodePageRoutingModule,
		SharedModule,
	],
	declarations: [ByCodePage],
})
export class ByCodePageModule {}
