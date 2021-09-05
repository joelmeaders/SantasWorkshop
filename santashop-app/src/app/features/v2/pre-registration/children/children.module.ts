import { NgModule } from '@angular/core';
import { ChildrenPageRoutingModule } from './children-routing.module';
import { ChildrenPage } from './children.page';
import { CoreModule } from '@core/*';
import { ChildModalComponent } from './child-modal/child-modal.component';

@NgModule({
  imports: [
    CoreModule,
    ChildrenPageRoutingModule
  ],
  declarations: [
    ChildrenPage,
    ChildModalComponent
  ]
})
export class ChildrenPageModule {}
