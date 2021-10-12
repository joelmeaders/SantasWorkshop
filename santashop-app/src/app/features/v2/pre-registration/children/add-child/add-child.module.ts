import { AddChildPageRoutingModule } from './add-child-routing.module';
import { AddChildPage } from './add-child.page';
import { CoreModule } from '@core/*';
import { NgModule } from '@angular/core';

@NgModule({
  imports: [
    CoreModule,
    AddChildPageRoutingModule
  ],
  declarations: [AddChildPage]
})
export class AddChildPageModule {}
