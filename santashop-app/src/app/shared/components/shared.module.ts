import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CreateChildModalComponent } from '@app/shared/components/create-child-modal/create-child-modal.component';
import { CoreDirectivesModule } from '@app/core/directives/core-directives.module';
import { ResetPasswordComponent } from '@app/shared/components/reset-password/reset-password.component';
import { PublicMenuComponent } from '@app/shared/components/public-menu/public-menu.component';
import { PrivacyPolicyModalComponent } from '@app/shared/components/privacy-policy-modal/privacy-policy-modal.component';
import { TermsOfServiceModalComponent } from '@app/shared/components/terms-of-service-modal/terms-of-service-modal.component';
import { TranslateModule } from '@ngx-translate/core';
// import { QrModalComponent } from '@app/shared/components/qr-modal/qr-modal.component';

@NgModule({
  declarations: [
    CreateChildModalComponent,
    ResetPasswordComponent,
    PublicMenuComponent,
    PrivacyPolicyModalComponent,
    TermsOfServiceModalComponent,
    // QrModalComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    CoreDirectivesModule,
    TranslateModule
  ],
  exports: [
    CreateChildModalComponent,
    ResetPasswordComponent,
    PublicMenuComponent,
    PrivacyPolicyModalComponent,
    TermsOfServiceModalComponent,
    TranslateModule,
    // QrModalComponent
  ],
  entryComponents: [
    CreateChildModalComponent,
    ResetPasswordComponent,
    PublicMenuComponent,
    PrivacyPolicyModalComponent,
    TermsOfServiceModalComponent,
    // QrModalComponent
  ],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ]
})
export class SharedModule { }
