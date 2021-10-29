import { NgModule } from '@angular/core';
import { ProfilePageRoutingModule } from './profile-routing.module';
import { ProfilePage } from './profile.page';
import { CoreModule } from '@core/*';

@NgModule({
  imports: [
    CoreModule,
    ProfilePageRoutingModule
  ],
  declarations: [ProfilePage]
})
export class ProfilePageModule {}
