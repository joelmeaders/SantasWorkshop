import { NgModule } from '@angular/core';
import { CoreModule } from '@santashop/core';
import { SharedModule } from '../shared/components/shared.module';
import { HomePageRoutingModule } from './home-routing.module';
import { HomePage } from './home.page';

@NgModule({
	imports: [CoreModule, HomePageRoutingModule, SharedModule],
	declarations: [HomePage],
})
export class HomePageModule {}
