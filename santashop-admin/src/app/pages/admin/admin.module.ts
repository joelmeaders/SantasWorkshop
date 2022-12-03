import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';
import { AdminPageRoutingModule } from './admin-routing.module';
import { AdminPage } from './admin.page';

@NgModule({
	imports: [CommonModule, IonicModule, AdminPageRoutingModule],
	declarations: [AdminPage],
})
export class AdminPageModule {}
