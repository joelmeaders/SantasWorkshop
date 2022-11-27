import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { CheckinPageRoutingModule } from './checkin-routing.module';

import { SharedModule } from '../../../shared/shared.module';
import { CheckInContextService } from '../../../shared/services/check-in-context.service';

@NgModule({
	imports: [
		CommonModule,
		IonicModule,
		CheckinPageRoutingModule,
		SharedModule,
	],
	providers: [CheckInContextService],
})
export class CheckinPageModule {}
