import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ReviewPageRoutingModule } from './review-routing.module';

import { ReviewPage } from './review.page';

import { CoreModule } from '@santashop/core';

@NgModule({
	imports: [CommonModule, ReviewPageRoutingModule, CoreModule, ReviewPage],
})
export class ReviewPageModule {}
