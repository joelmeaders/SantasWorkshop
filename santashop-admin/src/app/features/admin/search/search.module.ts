import { IonicModule } from '@ionic/angular';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchPage } from './search.page';
import { SearchPageRoutingModule } from './search-routing.module';
import { ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from 'santashop-admin/src/app/components/shared.module';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    SearchPageRoutingModule,
    SharedModule
  ],
  declarations: [SearchPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SearchPageModule {}
