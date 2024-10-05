import { NgModule } from '@angular/core';
import { ChildrenPageRoutingModule } from './children-routing.module';
import { ChildrenPage } from './children.page';
import { CoreModule } from '@santashop/core';


@NgModule({
    imports: [CoreModule, ChildrenPageRoutingModule, ChildrenPage],
})
export class ChildrenPageModule {}
