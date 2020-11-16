import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/components/shared.module';
import { ProfilePageRoutingModule } from './profile-routing.module';
import { ProfilePage } from './profile.page';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    ProfilePageRoutingModule,
    SharedModule,
  ],
  declarations: [ProfilePage],
})
export class ProfilePageModule {}
