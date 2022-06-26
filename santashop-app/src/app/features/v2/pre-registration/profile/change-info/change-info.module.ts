import { NgModule } from '@angular/core';
import { ChangeInfoPageRoutingModule } from './change-info-routing.module';
import { ChangeInfoPage } from './change-info.page';
import { CoreModule } from '@core/*';
import { SharedModule } from 'santashop-app/src/app/shared/components/shared.module';

@NgModule({
  imports: [CoreModule, SharedModule, ChangeInfoPageRoutingModule],
  declarations: [ChangeInfoPage],
})
export class ChangeInfoPageModule {}
