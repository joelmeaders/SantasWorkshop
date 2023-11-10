import { NgModule } from '@angular/core';
import { InformationPageRoutingModule } from './overview-routing.module';
import { OverviewPage } from './overview.page';
import { CoreModule } from '@santashop/core';
import { SharedModule } from 'santashop-app/src/app/shared/components/shared.module';
import { ChildrenCardComponent } from './children-card/children-card.component';
import { ScheduleCardComponent } from './schedule-card/schedule-card.component';
import { SubmitCardComponent } from './submit-card/submit-card.component';
import { ReferralCardComponent } from './referral-card/referral-card.component';

@NgModule({
	imports: [CoreModule, SharedModule, InformationPageRoutingModule],
	declarations: [
		OverviewPage,
		ChildrenCardComponent,
		ScheduleCardComponent,
		SubmitCardComponent,
		ReferralCardComponent,
	],
})
export class InformationPageModule {}
