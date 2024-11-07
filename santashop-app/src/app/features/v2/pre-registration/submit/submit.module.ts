import { NgModule } from '@angular/core';
import { SubmitPageRoutingModule } from './submit-routing.module';
import { SubmitPage } from './submit.page';
import { CoreModule } from '@santashop/core';


@NgModule({
    imports: [CoreModule, SubmitPageRoutingModule, SubmitPage],
})
export class SubmitPageModule {}
