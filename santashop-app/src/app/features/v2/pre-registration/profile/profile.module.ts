import { NgModule } from '@angular/core';
import { ProfilePageRoutingModule } from './profile-routing.module';
import { ProfilePage } from './profile.page';
import { CoreModule } from '@santashop/core';


@NgModule({
    imports: [CoreModule, ProfilePageRoutingModule, ProfilePage],
})
export class ProfilePageModule {}
