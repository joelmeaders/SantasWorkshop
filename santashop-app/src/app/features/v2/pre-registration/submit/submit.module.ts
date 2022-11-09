import { NgModule } from '@angular/core';
import { SubmitPageRoutingModule } from './submit-routing.module';
import { SubmitPage } from './submit.page';
import { CoreModule } from '@core/*';
import { SharedModule } from '../../../../shared/components/shared.module';

@NgModule({
	imports: [CoreModule, SharedModule, SubmitPageRoutingModule],
	declarations: [SubmitPage],
})
export class SubmitPageModule {}
