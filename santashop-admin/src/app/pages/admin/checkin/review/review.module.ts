import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ReviewPageRoutingModule } from './review-routing.module';

import { ReviewPage } from './review.page';

@NgModule({
	imports: [CommonModule, ReviewPageRoutingModule, ReviewPage],
})
export class ReviewPageModule {}
