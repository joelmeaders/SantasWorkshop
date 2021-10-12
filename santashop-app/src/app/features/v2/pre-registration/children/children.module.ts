import { NgModule } from '@angular/core';
import { ChildrenPageRoutingModule } from './children-routing.module';
import { ChildrenPage } from './children.page';
import { CoreModule } from '@core/*';

@NgModule({
  imports: [
    CoreModule,
    ChildrenPageRoutingModule
  ],
  declarations: [
    ChildrenPage,
  ]
})
export class ChildrenPageModule {}
