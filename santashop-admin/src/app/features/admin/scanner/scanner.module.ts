import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { SharedComponentsModule } from 'app/shared/components/shared-components.module';
import { CoreDirectivesModule } from 'santashop-core-lib';
import { ScannerPageRoutingModule } from './scanner-routing.module';
import { ScannerPage } from './scanner.page';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    ScannerPageRoutingModule,
    ZXingScannerModule,
    CoreDirectivesModule,
    SharedComponentsModule
  ],
  declarations: [ScannerPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ScannerPageModule {}