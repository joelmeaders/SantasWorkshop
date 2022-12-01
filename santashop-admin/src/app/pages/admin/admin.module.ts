import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { AdminPageRoutingModule } from './admin-routing.module';

import { AdminPage } from './admin.page';
import { CheckInContextService } from '../../shared/services/check-in-context.service';

@NgModule({
	imports: [CommonModule, IonicModule, AdminPageRoutingModule],
	declarations: [AdminPage],
	providers: [CheckInContextService],
})
export class AdminPageModule {}
