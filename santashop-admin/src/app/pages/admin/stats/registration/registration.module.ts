import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { RegistrationPageRoutingModule } from './registration-routing.module';

import { RegistrationPage } from './registration.page';
import { SharedModule } from '../../../../shared/shared.module';
import { NgChartsModule } from 'ng2-charts';
import { CoreModule } from '@santashop/core';

@NgModule({
	imports: [
		CommonModule,
		IonicModule,
		CoreModule,
		SharedModule,
		RegistrationPageRoutingModule,
		NgChartsModule,
	],
	declarations: [RegistrationPage],
})
export class RegistrationPageModule {}
