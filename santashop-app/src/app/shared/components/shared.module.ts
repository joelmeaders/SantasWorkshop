import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CoreModule } from '@core/*';
import { InternalHeaderComponent } from './internal-header/internal-header.component';
import { LanguageToggleComponent } from './language-toggle/language-toggle.component';
import { PreRegistrationMenuComponent } from './pre-registration-menu/pre-registration-menu.component';
import { PrivacyPolicyModalComponent } from './privacy-policy-modal/privacy-policy-modal.component';
import { PublicMenuComponent } from './public-menu/public-menu.component';
import { TermsOfServiceModalComponent } from './terms-of-service-modal/terms-of-service-modal.component';

@NgModule({
	imports: [CoreModule],
	declarations: [
		PublicMenuComponent,
		PrivacyPolicyModalComponent,
		TermsOfServiceModalComponent,
		PreRegistrationMenuComponent,
		LanguageToggleComponent,
		InternalHeaderComponent,
	],
	exports: [
		PublicMenuComponent,
		PrivacyPolicyModalComponent,
		TermsOfServiceModalComponent,
		TranslateModule,
		PreRegistrationMenuComponent,
		LanguageToggleComponent,
		InternalHeaderComponent,
	],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SharedModule {}
