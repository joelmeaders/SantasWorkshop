import { NgModule } from '@angular/core';
import { ProfilePageRoutingModule } from './profile-routing.module';
import { ProfilePage } from './profile.page';
import { CoreModule } from 'santashop-core/src/public-api';
import { SharedModule } from 'santashop-app/src/app/shared/components/shared.module';

@NgModule({
	imports: [CoreModule, SharedModule, ProfilePageRoutingModule],
	declarations: [ProfilePage],
})
export class ProfilePageModule {}
