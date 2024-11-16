import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DuplicatePageRoutingModule } from './duplicate-routing.module';

import { DuplicatePage } from './duplicate.page';

@NgModule({
	imports: [CommonModule, DuplicatePageRoutingModule, DuplicatePage],
})
export class DuplicatePageModule {}
