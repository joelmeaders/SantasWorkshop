import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ResultsPageRoutingModule } from './results-routing.module';

import { ResultsPage } from './results.page';

import { CoreModule } from '@santashop/core';

@NgModule({
	imports: [CommonModule, ResultsPageRoutingModule, CoreModule, ResultsPage],
})
export class ResultsPageModule {}
