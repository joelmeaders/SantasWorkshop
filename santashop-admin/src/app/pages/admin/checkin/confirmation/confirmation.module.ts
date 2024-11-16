import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ConfirmationPageRoutingModule } from './confirmation-routing.module';

import { ConfirmationPage } from './confirmation.page';

@NgModule({
	imports: [CommonModule, ConfirmationPageRoutingModule, ConfirmationPage],
})
export class ConfirmationPageModule {}
