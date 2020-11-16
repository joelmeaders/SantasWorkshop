import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CoreDirectivesModule, LetDirective } from 'santashop-core/src/public-api';
import { QrModalComponent } from './qr-modal/qr-modal.component';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    CoreDirectivesModule
  ],
  exports: [
    QrModalComponent,
    LetDirective
  ],
  declarations: [
    QrModalComponent
  ]
})
export class SharedComponentsModule {}