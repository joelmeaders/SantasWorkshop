import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { CheckinPageRoutingModule } from './checkin-routing.module';

import { CheckinPage } from './checkin.page';
import { ScannerService } from './services/scanner.service';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
	imports: [
		CommonModule,
		IonicModule,
		CheckinPageRoutingModule,
		ZXingScannerModule,
		SharedModule,
	],
	declarations: [CheckinPage],
	providers: [ScannerService],
})
export class CheckinPageModule {}
