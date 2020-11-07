import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { HomePage } from './home.page';

import { HomePageRoutingModule } from './home-routing.module';
import { SharedModule } from '@app/shared/components/shared.module';
import { CoreDirectivesModule } from '@app/core/directives/core-directives.module';


@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HomePageRoutingModule,
    SharedModule,
    CoreDirectivesModule
  ],
  declarations: [HomePage]
})
export class HomePageModule {}
