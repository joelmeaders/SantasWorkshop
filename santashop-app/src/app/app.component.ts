import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import {
	AlertController,
	IonApp,
	IonRouterOutlet,
	ModalController,
	Platform,
} from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { AppStateService } from '@santashop/core';
import { ApplicationService } from './core/services/application.service';
import { firstValueFrom } from 'rxjs';

@Component({
	selector: 'app-root',
	templateUrl: 'app.component.html',
	styleUrls: ['app.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [IonApp, IonRouterOutlet],
	providers: [ModalController],
})
export class AppComponent {
	private readonly platform = inject(Platform);
	private readonly translateService = inject(TranslateService);
	private readonly analyticsService = inject(Analytics);
	private readonly appStateService = inject(AppStateService);
	private readonly applicationService = inject(ApplicationService);
	private readonly alertController = inject(AlertController);

	constructor() {
		this.initializeApp();
	}

	public async initializeApp(): Promise<void> {
		await this.platform.ready().then(() => {
			// Trigger modal management subscriptions
			if (!this.applicationService) throw new Error('Placeholder');
		});

		this.translateService.addLangs(['en', 'es']);
		this.translateService.setFallbackLang('en');

		const browserLang = this.translateService.getBrowserLang() ?? 'en';
		this.translateService.use(
			browserLang.match(/en|es/) ? browserLang : 'en',
		);

		logEvent(this.analyticsService, 'default_language', {
			value: browserLang,
		});

		const alert = await firstValueFrom(this.appStateService.globalAlert$);
		if (alert?.displayAlert) {
			const isEnglish = this.translateService.currentLang === 'en';
			const title = isEnglish ? alert.titleEn : alert.titleEs;
			const message = isEnglish ? alert.messageEn : alert.messageEs;
			await this.showGlobalMessage({ title, message });
		}
	}

	public async showGlobalMessage(globalAlert: {
		title: string;
		message: string;
	}): Promise<void> {
		const alert = await this.alertController.create({
			header: globalAlert.title,
			message: globalAlert.message,
			buttons: ['Dismiss'],
		});

		await alert.present();
	}
}
