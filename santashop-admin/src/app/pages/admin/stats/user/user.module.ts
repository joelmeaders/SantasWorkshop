import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { UserPageRoutingModule } from './user-routing.module';
import { UserPage } from './user.page';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
	imports: [
		CommonModule,
		IonicModule,
		UserPageRoutingModule,
		SharedModule,
		BaseChartDirective
	],
	providers: [
		provideCharts(withDefaultRegisterables())
	],
	declarations: [UserPage],

})
export class UserPageModule {}
