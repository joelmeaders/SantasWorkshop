import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CoreModule } from 'santashop-core/src';
import { PreRegistrationMenuComponent } from './pre-registration-menu/pre-registration-menu.component';
import { PrivacyPolicyModalComponent } from './privacy-policy-modal/privacy-policy-modal.component';
import { PublicMenuComponent } from './public-menu/public-menu.component';
import { TermsOfServiceModalComponent } from './terms-of-service-modal/terms-of-service-modal.component';

@NgModule({
  declarations: [
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
