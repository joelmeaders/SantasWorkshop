import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { HeaderComponent } from './components/header/header.component';
import { QrModalComponent } from './components/qr-modal/qr-modal.component';
import { CheckInService } from './services/check-in.service';
import { LookupService } from './services/lookup.service';
import { RegistrationContextService } from './services/registration-context.service';

@NgModule({
	declarations: [QrModalComponent, HeaderComponent],
	imports: [CommonModule, IonicModule],
	exports: [QrModalComponent, HeaderComponent],
	providers: [LookupService, RegistrationContextService, CheckInService],
})
export class SharedModule {}
