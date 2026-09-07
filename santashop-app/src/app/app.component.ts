import { CustomerLanguageService } from './core/services/customer-language.service';
import { firstValueFrom } from 'rxjs';
import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	OnInit,
	inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
	AlertController,
	IonApp,
	IonRouterOutlet,
	ModalController,
	Platform,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
	AnalyticsWrapper,
	AppStateService,
	AppUpdatePromptComponent,
} from '@santashop/core/customer';
import { ApplicationService } from './core/services/application.service';

@Component({
	selector: 'app-root',
	templateUrl: 'app.component.html',
	styleUrls: ['app.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [IonApp, IonRouterOutlet, TranslateModule, AppUpdatePromptComponent],
	providers: [ModalController],
})
export class AppComponent implements OnInit {
	private static readonly languageStorageKey = 'santashop-language';

	private readonly language = inject(CustomerLanguageService);
	private readonly platform = inject(Platform);
	private readonly translateService = inject(TranslateService);
	private readonly analyticsService = inject(AnalyticsWrapper);
	private readonly appStateService = inject(AppStateService);
	private readonly applicationService = inject(ApplicationService);
	private readonly alertController = inject(AlertController);
	private readonly destroyRef = inject(DestroyRef);
	private activeGlobalAlert?: Awaited<ReturnType<AlertController['create']>>;
	private alertUpdate: Promise<void> = Promise.resolve();

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
		const storedLanguage = window.localStorage.getItem(
			AppComponent.languageStorageKey,
		);
		const supportedLanguage: 'en' | 'es' =
			storedLanguage === 'en' || storedLanguage === 'es'
				? storedLanguage
				: browserLang === 'es'
					? 'es'
					: 'en';
		await firstValueFrom(this.translateService.use(supportedLanguage));
		this.language.initialize();

		this.analyticsService.logEventWithParams('default_language', {
			value: browserLang,
		});

		this.appStateService.globalAlert$
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((alert) => {
				const isEnglish =
					this.translateService.getCurrentLang() === 'en';
				const message = alert?.displayAlert ? {
					title: isEnglish ? alert.titleEn : alert.titleEs,
					message: isEnglish ? alert.messageEn : alert.messageEs,
				} : undefined;
				this.alertUpdate = this.alertUpdate.then(() => this.showGlobalMessage(message))
					.catch((error: unknown): void => { console.error('Global alert could not update.', error); });
			});
	}

	public async showGlobalMessage(globalAlert?: {
		title: string;
		message: string;
	}): Promise<void> {
		await this.activeGlobalAlert?.dismiss();
		this.activeGlobalAlert = undefined;
		if (!globalAlert || this.destroyRef.destroyed) return;
		const alert = await this.alertController.create({
			header: globalAlert.title,
			message: globalAlert.message,
			buttons: ['Dismiss'],
		});

		this.activeGlobalAlert = alert;
		await alert.present();
	}
}
