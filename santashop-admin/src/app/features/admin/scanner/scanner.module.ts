import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from 'santashop-admin/src/app/components/shared.module';
import { ZXingScannerModule } from 'zxing-scanner/src/public_api';
import { ScannerPageRoutingModule } from './scanner-routing.module';
import { ScannerPage } from './scanner.page';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    ScannerPageRoutingModule,
    ZXingScannerModule,
    SharedModule
  ],
  declarations: [ScannerPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ScannerPageModule {}
