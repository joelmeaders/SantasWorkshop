import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { CheckinPageRoutingModule } from './checkin-routing.module';

import { SharedModule } from '../../../shared/shared.module';

@NgModule({
	imports: [
		CommonModule,
		IonicModule,
		CheckinPageRoutingModule,
		SharedModule,
	],
})
export class CheckinPageModule {}
