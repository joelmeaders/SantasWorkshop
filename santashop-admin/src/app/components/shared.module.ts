import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CoreModule } from '@core/*';
import { ConvertHour24To12Pipe } from '../pipes/convert-hour-24-to-12.pipe';
import { DeviceNameOnlyPipe } from '../pipes/device-name-only.pipe';
import { QrModalComponent } from './qr-modal/qr-modal.component';

@NgModule({
  declarations: [
    QrModalComponent,
    DeviceNameOnlyPipe,
    ConvertHour24To12Pipe
  ],
  imports: [
    CoreModule
  ],
  exports: [
    QrModalComponent,
    DeviceNameOnlyPipe,
    ConvertHour24To12Pipe
  ],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ]
})
export class SharedModule { }
