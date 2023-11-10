import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { ReviewPageRoutingModule } from './review-routing.module';

import { ReviewPage } from './review.page';
import { SharedModule } from '../../../../shared/shared.module';
import { CoreModule } from '@santashop/core';

@NgModule({
	imports: [
		CommonModule,
		IonicModule,
		ReviewPageRoutingModule,
		CoreModule,
		SharedModule,
	],
	declarations: [ReviewPage],
})
export class ReviewPageModule {}
