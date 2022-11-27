import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { ConfirmationPageRoutingModule } from './confirmation-routing.module';

import { ConfirmationPage } from './confirmation.page';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
	imports: [
		CommonModule,
		IonicModule,
		ConfirmationPageRoutingModule,
		SharedModule,
	],
	declarations: [ConfirmationPage],
})
export class ConfirmationPageModule {}
