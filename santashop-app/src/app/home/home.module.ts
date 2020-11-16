import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '@app/shared/components/shared.module';
import { IonicModule } from '@ionic/angular';
import { CoreDirectivesModule } from 'santashop-core-lib';
import { HomePageRoutingModule } from './home-routing.module';
import { HomePage } from './home.page';

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
