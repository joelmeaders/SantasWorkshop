import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { ScanPage } from './scan.page';
import { SharedModule } from '../../../../shared/shared.module';
import { CoreModule } from '@core/*';
import { ScanPageRoutingModule } from './scan-routing.module';
import { ScannerService } from './scanner.service';

@NgModule({
	imports: [
		CommonModule,
		IonicModule,
		ScanPageRoutingModule,
		CoreModule,
		ZXingScannerModule,
		SharedModule,
	],
	declarations: [ScanPage],
	providers: [ScannerService],
})
export class ScanPageModule {}
