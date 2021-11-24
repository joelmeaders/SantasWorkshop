import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CoreModule } from '@core/*';
import { ConvertHour24To12Pipe } from '../pipes/convert-hour-24-to-12.pipe';
import { DeviceNameOnlyPipe } from '../pipes/device-name-only.pipe';
import { FriendlyToyTypePipe } from '../pipes/friendly-toy-type.pipe';
import { QrModalComponent } from './qr-modal/qr-modal.component';

@NgModule({
  declarations: [
    QrModalComponent,
    DeviceNameOnlyPipe,
    ConvertHour24To12Pipe,
    FriendlyToyTypePipe
  ],
  imports: [
    CoreModule
  ],
  exports: [
    QrModalComponent,
    DeviceNameOnlyPipe,
    ConvertHour24To12Pipe,
    FriendlyToyTypePipe
  ],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ]
})
export class SharedModule { }
