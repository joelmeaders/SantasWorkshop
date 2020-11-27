import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { FriendlyTimePipe } from 'santashop-admin/src/app/pipes/friendly-time.pipe';
import { SharedComponentsModule } from 'santashop-admin/src/components/shared-components.module';
import { StatsPageRoutingModule } from './stats-routing.module';
import { StatsPage } from './stats.page';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild([{ path: '', component: StatsPage }]),
    StatsPageRoutingModule,
    SharedComponentsModule
  ],
  declarations: [StatsPage, FriendlyTimePipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class StatsPageModule {}
