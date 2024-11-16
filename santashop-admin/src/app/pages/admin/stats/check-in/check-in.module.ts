import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CheckInPageRoutingModule } from './check-in-routing.module';

import { CheckInPage } from './check-in.page';

import {
	BaseChartDirective,
	provideCharts,
	withDefaultRegisterables,
} from 'ng2-charts';
import { CoreModule } from '@santashop/core';
import { FormsModule } from '@angular/forms';

@NgModule({
	imports: [
		CommonModule,

		CoreModule,
		CheckInPageRoutingModule,
		FormsModule,
		BaseChartDirective,
		CheckInPage,
	],
	providers: [provideCharts(withDefaultRegisterables())],
})
export class CheckInPageModule {}
