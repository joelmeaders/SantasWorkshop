import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CreateChildModalComponent } from '@app/shared/components/create-child-modal/create-child-modal.component';
import { PrivacyPolicyModalComponent } from '@app/shared/components/privacy-policy-modal/privacy-policy-modal.component';
import { PublicMenuComponent } from '@app/shared/components/public-menu/public-menu.component';
import { ResetPasswordComponent } from '@app/shared/components/reset-password/reset-password.component';
import { TermsOfServiceModalComponent } from '@app/shared/components/terms-of-service-modal/terms-of-service-modal.component';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { CoreDirectivesModule, LetDirective } from 'santashop-core-lib';

@NgModule({
  declarations: [
    CreateChildModalComponent,
    ResetPasswordComponent,
    PublicMenuComponent,
    PrivacyPolicyModalComponent,
    TermsOfServiceModalComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    TranslateModule,
    CoreDirectivesModule
  ],
  exports: [
    CreateChildModalComponent,
    ResetPasswordComponent,
    PublicMenuComponent,
    PrivacyPolicyModalComponent,
    TermsOfServiceModalComponent,
    TranslateModule,
    LetDirective
  ],
  entryComponents: [
    CreateChildModalComponent,
    ResetPasswordComponent,
    PublicMenuComponent,
    PrivacyPolicyModalComponent,
    TermsOfServiceModalComponent,
  ],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ]
})
export class SharedModule { }
