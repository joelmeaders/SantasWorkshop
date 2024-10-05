import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
	BaseChartDirective,
	provideCharts,
	withDefaultRegisterables,
} from 'ng2-charts';
import { UserPageRoutingModule } from './user-routing.module';
import { UserPage } from './user.page';

@NgModule({
	imports: [
		CommonModule,

		UserPageRoutingModule,
		BaseChartDirective,
		UserPage,
	],
	providers: [provideCharts(withDefaultRegisterables())],
})
export class UserPageModule {}
