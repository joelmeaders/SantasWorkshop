import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { DuplicatePageRoutingModule } from './duplicate-routing.module';

import { DuplicatePage } from './duplicate.page';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
	imports: [
		CommonModule,
		IonicModule,
		DuplicatePageRoutingModule,
		SharedModule,
	],
	declarations: [DuplicatePage],
})
export class DuplicatePageModule {}
