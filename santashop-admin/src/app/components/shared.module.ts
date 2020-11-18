import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CoreDirectivesModule, LetDirective } from 'santashop-core/src/public-api';
import { QrModalComponent } from './qr-modal/qr-modal.component';
import { GlobalMessageModalComponent } from './global-message-modal/global-message-modal.component';

@NgModule({
  declarations: [
    QrModalComponent,
    GlobalMessageModalComponent
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
    GlobalMessageModalComponent
  ],
  entryComponents: [
    QrModalComponent,
    GlobalMessageModalComponent
  ],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ]
})
export class SharedModule { }
