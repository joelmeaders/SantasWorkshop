import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { SearchPage } from './search.page';
import { SearchPageRoutingModule } from './search-routing.module';
import { SharedModule } from 'santashop-admin/src/app/components/shared.module';
import { CoreModule } from '@core/*';

@NgModule({
	imports: [CoreModule, SearchPageRoutingModule, SharedModule],
	declarations: [SearchPage],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SearchPageModule {}
