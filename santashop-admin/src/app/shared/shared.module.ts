import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { QrModalComponent } from './components/qr-modal/qr-modal.component';
import { CheckInService } from './services/check-in.service';
import { LookupService } from './services/lookup.service';
import { RegistrationContextService } from './services/registration-context.service';

@NgModule({
	declarations: [QrModalComponent],
	imports: [CommonModule, IonicModule],
	exports: [QrModalComponent],
	providers: [LookupService, RegistrationContextService, CheckInService],
})
export class SharedModule {}
