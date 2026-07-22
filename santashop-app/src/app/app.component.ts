import {
	ChangeDetectionStrategy,
	Component,
	OnInit,
	inject,
} from '@angular/core';
import {
	AlertController,
	IonApp,
	IonRouterOutlet,
	ModalController,
	Platform,
} from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { AnalyticsWrapper, AppStateService } from '@santashop/core';
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
export class AppComponent implements OnInit {
	private readonly platform = inject(Platform);
	private readonly translateService = inject(TranslateService);
	private readonly analyticsService = inject(AnalyticsWrapper);
	private readonly appStateService = inject(AppStateService);
	private readonly applicationService = inject(ApplicationService);
	private readonly alertController = inject(AlertController);

	public ngOnInit(): void {
		void this.initializeApp();
	}

	public async initializeApp(): Promise<void> {
		await this.platform.ready().then(() => {
			// Trigger modal management subscriptions
			if (!this.applicationService) throw new Error('Placeholder');
		});

		this.translateService.addLangs(['en', 'es']);
		this.translateService.setFallbackLang('en');

		const browserLang = this.translateService.getBrowserLang() ?? 'en';
		const supportedLanguage = /en|es/.exec(browserLang) ? browserLang : 'en';
		this.translateService.use(
			supportedLanguage,
		);

		this.analyticsService.logEventWithParams('default_language', {
			value: browserLang,
		});

		const alert = await firstValueFrom(this.appStateService.globalAlert$);
		if (alert?.displayAlert) {
			const isEnglish = this.translateService.getCurrentLang() === 'en';
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
