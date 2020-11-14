import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ScannerPageRoutingModule } from './scanner-routing.module';

import { ScannerPage } from './scanner.page';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
// import { SharedModule } from '@app/shared/components/shared.module';
// import { CoreDirectivesModule } from '@app/core/directives/core-directives.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    // SharedModule,
    // CoreDirectivesModule,
    ScannerPageRoutingModule,
    ZXingScannerModule
  ],
  declarations: [ScannerPage]
})
export class ScannerPageModule {}
