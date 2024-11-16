import { AddChildPageRoutingModule } from './add-child-routing.module';
import { AddChildPage } from './add-child.page';
import { CoreModule } from '@santashop/core';
import { NgModule } from '@angular/core';

@NgModule({
	imports: [CoreModule, AddChildPageRoutingModule, AddChildPage],
})
export class AddChildPageModule {}
