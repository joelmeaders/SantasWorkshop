import { NgModule } from '@angular/core';
import { InformationPageRoutingModule } from './overview-routing.module';
import { OverviewPage } from './overview.page';
import { CoreModule } from 'santashop-core/src/public-api';
import { SharedModule } from 'santashop-app/src/app/shared/components/shared.module';

@NgModule({
	imports: [CoreModule, SharedModule, InformationPageRoutingModule],
	declarations: [OverviewPage],
})
export class InformationPageModule {}
