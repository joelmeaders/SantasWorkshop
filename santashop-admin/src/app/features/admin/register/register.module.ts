import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CoreModule } from 'santashop-core/src/public-api';
import { SharedModule } from 'santashop-admin/src/app/components/shared.module';
import { RegisterPageRoutingModule } from './register-routing.module';
import { RegisterPage } from './register.page';

@NgModule({
	imports: [
		CoreModule,
		RouterModule.forChild([{ path: '', component: RegisterPage }]),
		RegisterPageRoutingModule,
		SharedModule,
	],
	declarations: [RegisterPage],
})
export class RegisterPageModule {}
