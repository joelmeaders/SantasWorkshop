import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CoreModule } from '@core/*';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { SharedModule } from 'santashop-admin/src/app/components/shared.module';
import { ScannerPageRoutingModule } from './scanner-routing.module';
import { ScannerPage } from './scanner.page';

@NgModule({
  imports: [
    CoreModule,
    ScannerPageRoutingModule,
    ZXingScannerModule,
    SharedModule,
  ],
  declarations: [ScannerPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ScannerPageModule {}
