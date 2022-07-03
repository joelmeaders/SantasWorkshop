import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { Platform } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { AppStateService } from './core';

@Component({
	selector: 'app-root',
	templateUrl: 'app.component.html',
	styleUrls: ['app.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
	constructor(
		private readonly platform: Platform,
		private readonly translateService: TranslateService,
		private readonly appStateService: AppStateService,
		private readonly analyticsService: Analytics
	) {
		this.initializeApp();
	}

	async initializeApp() {
		await this.platform.ready().then(() => {
			// This is here to kick off the appstateservice
			console.log('AppStateService Injected', !!this.appStateService);
		});

		this.translateService.addLangs(['en', 'es']);
		this.translateService.setDefaultLang('en');

		const browserLang = this.translateService.getBrowserLang() ?? 'en';
		this.translateService.use(
			browserLang.match(/en|es/) ? browserLang : 'en'
		);

		await logEvent(this.analyticsService, 'default_language', {
			value: browserLang,
		});
	}
}
