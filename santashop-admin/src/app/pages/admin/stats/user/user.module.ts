import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { UserPageRoutingModule } from './user-routing.module';
import { UserPage } from './user.page';
import { SharedModule } from '../../../../shared/shared.module';
import { NgChartsModule } from 'ng2-charts';

@NgModule({
	imports: [
		CommonModule,
		IonicModule,
		UserPageRoutingModule,
		SharedModule,
		NgChartsModule,
	],
	declarations: [UserPage],
})
export class UserPageModule {}
