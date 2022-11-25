import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ByEmailPageRoutingModule } from './by-email-routing.module';

import { ByEmailPage } from './by-email.page';
import { SharedModule } from '../../../../shared/shared.module';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
	imports: [
		CommonModule,
		IonicModule,
		ReactiveFormsModule,
		ByEmailPageRoutingModule,
		SharedModule,
	],
	declarations: [ByEmailPage],
})
export class ByEmailPageModule {}
