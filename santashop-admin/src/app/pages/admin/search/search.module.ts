import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SearchPageRoutingModule } from './search-routing.module';

import { SearchPage } from './search.page';

import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
	imports: [
		CommonModule,

		SearchPageRoutingModule,
		ReactiveFormsModule,
		SearchPage,
	],
})
export class SearchPageModule {}
