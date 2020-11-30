import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CoreDirectivesModule, LetDirective } from 'santashop-core/src/public-api';
import { DeviceNameOnlyPipe } from '../pipes/device-name-only.pipe';
import { FriendlyTimePipe } from '../pipes/friendly-time.pipe';
import { HydrateAgeGroupPipe } from '../pipes/hydrate-age-group.pipe';
import { HydrateToyTypePipe } from '../pipes/hydrate-toy-type.pipe';
import { QrModalComponent } from './qr-modal/qr-modal.component';

@NgModule({
  declarations: [
    QrModalComponent,
    FriendlyTimePipe,
    HydrateAgeGroupPipe,
    HydrateToyTypePipe,
    DeviceNameOnlyPipe
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    CoreDirectivesModule
  ],
  exports: [
    QrModalComponent,
    LetDirective,
    FriendlyTimePipe,
    HydrateAgeGroupPipe,
    HydrateToyTypePipe,
    DeviceNameOnlyPipe
  ],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ]
})
export class SharedModule { }
