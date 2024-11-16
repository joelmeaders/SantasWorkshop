import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AdminPageRoutingModule } from './admin-routing.module';
import { AdminPage } from './admin.page';

@NgModule({
	imports: [CommonModule, AdminPageRoutingModule, AdminPage],
})
export class AdminPageModule {}
