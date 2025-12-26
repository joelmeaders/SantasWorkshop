import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ResultsPageRoutingModule } from './results-routing.module';

import { ResultsPage } from './results.page';

@NgModule({
	imports: [CommonModule, ResultsPageRoutingModule, ResultsPage],
})
export class ResultsPageModule {}
