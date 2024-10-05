import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
	BaseChartDirective,
	provideCharts,
	withDefaultRegisterables,
} from 'ng2-charts';

import { RegistrationPageRoutingModule } from './registration-routing.module';

import { RegistrationPage } from './registration.page';

import { CoreModule } from '@santashop/core';

@NgModule({
	imports: [
		CommonModule,

		CoreModule,
		RegistrationPageRoutingModule,
		BaseChartDirective,
		RegistrationPage,
	],
	providers: [provideCharts(withDefaultRegisterables())],
})
export class RegistrationPageModule {}
