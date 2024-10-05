import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { ScanPage } from './scan.page';

import { CoreModule } from '@santashop/core';
import { ScanPageRoutingModule } from './scan-routing.module';
import { ScannerService } from './scanner.service';

@NgModule({
	imports: [
		CommonModule,

		ScanPageRoutingModule,
		CoreModule,
		ZXingScannerModule,
		ScanPage,
	],
	providers: [ScannerService],
})
export class ScanPageModule {}
