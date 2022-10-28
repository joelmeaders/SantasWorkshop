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
		private readonly analyticsService: Analytics,
		private readonly appStateService: AppStateService
	) {
		this.initializeApp();
	}

	public async initializeApp(): Promise<void> {
		await this.platform.ready().then(() => {
			// This is here to kick off the appstateservice
			if (!this.appStateService) throw new Error('Placeholder');
		});

		this.translateService.addLangs(['en', 'es']);
		this.translateService.setDefaultLang('en');

		const browserLang = this.translateService.getBrowserLang() ?? 'en';
		this.translateService.use(
			browserLang.match(/en|es/) ? browserLang : 'en'
		);

		logEvent(this.analyticsService, 'default_language', {
			value: browserLang,
		});
	}
}
