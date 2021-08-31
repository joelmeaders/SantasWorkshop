import { NgModule } from '@angular/core';
import { SignInPageRoutingModule } from './sign-in-routing.module';
import { SignInPage } from './sign-in.page';
import { CoreModule } from '@core/*';

@NgModule({
  imports: [
    CoreModule,
    SignInPageRoutingModule
  ],
  declarations: [SignInPage]
})
export class SignInPageModule {}
