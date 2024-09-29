import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { RegistrationPageRoutingModule } from './registration-routing.module';

import { RegistrationPage } from './registration.page';
import { SharedModule } from '../../../../shared/shared.module';
import { CoreModule } from '@santashop/core';

@NgModule({
	imports: [
		CommonModule,
		IonicModule,
		CoreModule,
		SharedModule,
		RegistrationPageRoutingModule,
		BaseChartDirective
	],
	providers: [
		provideCharts(withDefaultRegisterables())
	],
	declarations: [RegistrationPage],
})
export class RegistrationPageModule {}
