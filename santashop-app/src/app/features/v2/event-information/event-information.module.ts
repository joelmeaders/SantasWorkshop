import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { EventInformationPageRoutingModule } from './event-information-routing.module';

import { EventInformationPage } from './event-information.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    EventInformationPageRoutingModule
  ],
  declarations: [EventInformationPage]
})
export class EventInformationPageModule {}
