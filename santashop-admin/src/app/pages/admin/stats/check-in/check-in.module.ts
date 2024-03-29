import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { CheckInPageRoutingModule } from './check-in-routing.module';

import { CheckInPage } from './check-in.page';
import { SharedModule } from '../../../../shared/shared.module';
import { NgChartsModule } from 'ng2-charts';
import { CoreModule } from '@santashop/core';
import { FormsModule } from '@angular/forms';

@NgModule({
	imports: [
		CommonModule,
		IonicModule,
		CoreModule,
		CheckInPageRoutingModule,
		SharedModule,
		NgChartsModule,
		FormsModule,
	],
	declarations: [CheckInPage],
})
export class CheckInPageModule {}
