import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { AdminPageRoutingModule } from './admin-routing.module';
import { AdminPage } from './admin.page';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    AdminPageRoutingModule
  ],
  declarations: [
    AdminPage
  ]
})
export class AdminPageModule {}
