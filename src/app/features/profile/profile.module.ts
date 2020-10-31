import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ProfilePageRoutingModule } from './profile-routing.module';

import { ProfilePage } from './profile.page';
import { CoreDirectivesModule } from '@app/core/directives/core-directives.module';
import { SharedModule } from '@app/shared/components/shared.module';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    ProfilePageRoutingModule,
    CoreDirectivesModule,
    SharedModule,
  ],
  declarations: [ProfilePage],
})
export class ProfilePageModule {}
