import { AdminSelectLanguageService } from './admin-select-language.service';
import {
	EnvironmentProviders,
	Injectable,
	inject,
	makeEnvironmentProviders,
	provideAppInitializer,
} from '@angular/core';
import {
	TranslateLoader,
	provideTranslateService,
	type TranslationObject,
} from '@ngx-translate/core';
import { Observable, from } from 'rxjs';
import { AdminLanguageService } from './admin-language.service';
import { AdminThemeService } from './admin-theme.service';
import { AlertController, LoadingController } from '@ionic/angular/standalone';
import { AdminAlertController, AdminLoadingController } from './admin-overlays';

@Injectable()
export class AdminTranslationLoader implements TranslateLoader {
	public getTranslation(language: string): Observable<TranslationObject> {
		return from(
			(language === 'es'
				? import('../../../assets/i18n/es.json')
				: import('../../../assets/i18n/en.json')
			).then((module) => module.default),
		);
	}
}

export function provideAdminLanguage(): EnvironmentProviders {
	return makeEnvironmentProviders([
		{ provide: AlertController, useExisting: AdminAlertController },
		{ provide: LoadingController, useExisting: AdminLoadingController },
		provideTranslateService({
			fallbackLang: 'en',
			loader: {
				provide: TranslateLoader,
				useClass: AdminTranslationLoader,
			},
		}),
		provideAppInitializer(() => {
			inject(AdminThemeService);
			inject(AdminSelectLanguageService);
			return inject(AdminLanguageService).initialize();
		}),
	]);
}
