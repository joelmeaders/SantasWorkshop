import { IonicModule } from '@ionic/angular';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchPage } from './search.page';

import { SearchPageRoutingModule } from './search-routing.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    SearchPageRoutingModule,
  ],
  declarations: [SearchPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SearchPageModule {}
