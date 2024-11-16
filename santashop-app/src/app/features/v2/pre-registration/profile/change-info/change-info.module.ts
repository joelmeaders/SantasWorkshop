import { NgModule } from '@angular/core';
import { ChangeInfoPageRoutingModule } from './change-info-routing.module';
import { ChangeInfoPage } from './change-info.page';
import { CoreModule } from '@santashop/core';

@NgModule({
	imports: [CoreModule, ChangeInfoPageRoutingModule, ChangeInfoPage],
})
export class ChangeInfoPageModule {}
