import { AddChildPageRoutingModule } from './add-child-routing.module';
import { AddChildPage } from './add-child.page';
import { CoreModule } from 'santashop-core/src/public-api';
import { NgModule } from '@angular/core';
import { SharedModule } from '../../../../../shared/components/shared.module';

@NgModule({
	imports: [CoreModule, SharedModule, AddChildPageRoutingModule],
	declarations: [AddChildPage],
})
export class AddChildPageModule {}
