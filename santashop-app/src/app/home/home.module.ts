import { NgModule } from '@angular/core';
import { CoreModule } from '@santashop/core';

import { HomePageRoutingModule } from './home-routing.module';
import { HomePage } from './home.page';

@NgModule({
    imports: [CoreModule, HomePageRoutingModule, HomePage],
})
export class HomePageModule {}
