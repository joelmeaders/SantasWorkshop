import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from 'santashop-admin/src/app/components/shared.module';
import { FriendlyTimePipe } from 'santashop-admin/src/app/pipes/friendly-time.pipe';
import { StatsPageRoutingModule } from './stats-routing.module';
import { StatsPage } from './stats.page';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild([{ path: '', component: StatsPage }]),
    StatsPageRoutingModule,
    SharedModule
  ],
  providers: [
    FriendlyTimePipe
  ],
  declarations: [StatsPage]
})
export class StatsPageModule {}
