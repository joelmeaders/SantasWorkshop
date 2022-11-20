import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CoreModule } from '@core/*';
import { SharedModule } from 'santashop-admin/src/app/components/shared.module';
import { QuickRegisterPage } from './quick-register.page';

@NgModule({
	imports: [
		CoreModule,
		RouterModule.forChild([{ path: '', component: QuickRegisterPage }]),
		QuickRegisterPageRoutingModule,
		SharedModule,
	],
	declarations: [QuickRegisterPage],
})
export class RegisterPageModule {}
