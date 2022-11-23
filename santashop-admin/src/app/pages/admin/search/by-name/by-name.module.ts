import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { ByNamePageRoutingModule } from './by-name-routing.module';

import { ByNamePage } from './by-name.page';
import { SharedModule } from '../../../../shared/shared.module';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
	imports: [
		CommonModule,
		ReactiveFormsModule,
		IonicModule,
		ByNamePageRoutingModule,
		SharedModule,
	],
	declarations: [ByNamePage],
})
export class ByNamePageModule {}
