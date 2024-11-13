import { NgModule } from '@angular/core';
import { SignInPageRoutingModule } from './sign-in-routing.module';
import { SignInPage } from './sign-in.page';
import { CoreModule } from '@santashop/core';

@NgModule({
    imports: [CoreModule, SignInPageRoutingModule, SignInPage],
})
export class SignInPageModule {}
