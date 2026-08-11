import {
	ChangeDetectionStrategy,
	Component,
	OnDestroy,
	inject,
} from '@angular/core';
import { AnalyticsWrapper } from '@santashop/core/customer';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, firstValueFrom, Subject } from 'rxjs';
import { shareReplay, takeUntil } from 'rxjs/operators';

import { AsyncPipe } from '@angular/common';
import { IonText, IonToggle } from '@ionic/angular';

@Component({
	selector: 'app-language-toggle',
	templateUrl: './language-toggle.component.html',
	styleUrls: ['./language-toggle.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [IonToggle, IonText, AsyncPipe, IonText, IonToggle],
})
export class LanguageToggleComponent implements OnDestroy {
	private readonly translate = inject(TranslateService);
	private readonly analyticsService = inject(AnalyticsWrapper);

	private readonly destroy$ = new Subject<void>();

	private readonly currentLangauge = new BehaviorSubject<'en' | 'es'>(
		this.translate.getCurrentLang() as any,
	);

	public readonly currentLanguage$ = this.currentLangauge
		.asObservable()
		.pipe(takeUntil(this.destroy$), shareReplay(1));

	public ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	public toggleLanguage(event: any): void {
		const current = this.translate.getCurrentLang();

		// This toggle value thing is because toggle fires ionChange twice
		const toggleValue = event.detail.checked ? 'en' : 'es';
		if (toggleValue === current) return;

		if (current === 'en') {
			this.setLanguage('es');
		} else {
			this.setLanguage('en');
		}
	}

	private async setLanguage(value: 'en' | 'es'): Promise<void> {
		await firstValueFrom(this.translate.use(value));
		window.localStorage.setItem('santashop-language', value);
		this.currentLangauge.next(value);
		this.analyticsService.logEventWithParams('set_language', { value });
	}
}
