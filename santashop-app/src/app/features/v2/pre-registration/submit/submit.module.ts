import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SubmitPageRoutingModule } from './submit-routing.module';

import { SubmitPage } from './submit.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SubmitPageRoutingModule
  ],
  declarations: [SubmitPage]
})
export class SubmitPageModule {}
