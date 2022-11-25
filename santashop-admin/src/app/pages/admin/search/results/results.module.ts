import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { ResultsPageRoutingModule } from './results-routing.module';

import { ResultsPage } from './results.page';
import { SharedModule } from '../../../../shared/shared.module';
import { CoreModule } from '@core/*';

@NgModule({
	imports: [
		CommonModule,
		IonicModule,
		ResultsPageRoutingModule,
		CoreModule,
		SharedModule,
	],
	declarations: [ResultsPage],
})
export class ResultsPageModule {}
