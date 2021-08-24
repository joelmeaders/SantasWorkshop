import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CoreModule } from 'santashop-core/src';
import { CreateChildModalComponent } from './create-child-modal/create-child-modal.component';
import { PreRegistrationMenuComponent } from './pre-registration-menu/pre-registration-menu.component';
import { PrivacyPolicyModalComponent } from './privacy-policy-modal/privacy-policy-modal.component';
import { PublicMenuComponent } from './public-menu/public-menu.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { TermsOfServiceModalComponent } from './terms-of-service-modal/terms-of-service-modal.component';

@NgModule({
  declarations: [
    CreateChildModalComponent,
    ResetPasswordComponent,
    PublicMenuComponent,
    PrivacyPolicyModalComponent,
    TermsOfServiceModalComponent,
    PreRegistrationMenuComponent
  ],
  imports: [
    CoreModule,
    TranslateModule,
  ],
  exports: [
    CreateChildModalComponent,
    ResetPasswordComponent,
    PublicMenuComponent,
    PrivacyPolicyModalComponent,
    TermsOfServiceModalComponent,
    TranslateModule,
    PreRegistrationMenuComponent
  ],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ]
})
export class SharedModule { }
