import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MaintenancePageRoutingModule } from './maintenance-routing.module';

import { MaintenancePage } from './maintenance.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MaintenancePageRoutingModule
  ],
  declarations: [MaintenancePage]
})
export class MaintenancePageModule {}
