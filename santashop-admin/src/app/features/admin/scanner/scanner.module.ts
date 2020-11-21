import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { SharedComponentsModule } from 'santashop-admin/src/components/shared-components.module';
import { ZXingScannerModule } from 'zxing-scanner/src/public_api';
import { ScannerPageRoutingModule } from './scanner-routing.module';
import { ScannerPage } from './scanner.page';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    ScannerPageRoutingModule,
    ZXingScannerModule,
    SharedComponentsModule
  ],
  declarations: [ScannerPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ScannerPageModule {}
