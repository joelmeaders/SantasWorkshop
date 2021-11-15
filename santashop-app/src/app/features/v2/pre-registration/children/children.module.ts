import { NgModule } from '@angular/core';
import { ChildrenPageRoutingModule } from './children-routing.module';
import { ChildrenPage } from './children.page';
import { CoreModule } from '@core/*';
import { SharedModule } from '../../../../shared/components/shared.module';

@NgModule({
  imports: [
    CoreModule,
    SharedModule,
    ChildrenPageRoutingModule
  ],
  declarations: [
    ChildrenPage,
  ]
})
export class ChildrenPageModule {}
