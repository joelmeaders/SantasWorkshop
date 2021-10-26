import { NgModule } from '@angular/core';
import { SubmitPageRoutingModule } from './submit-routing.module';
import { SubmitPage } from './submit.page';
import { CoreModule } from '@core/*';

@NgModule({
  imports: [
    CoreModule,
    SubmitPageRoutingModule
  ],
  declarations: [SubmitPage]
})
export class SubmitPageModule {}
