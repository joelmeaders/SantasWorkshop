import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { first, shareReplay, takeUntil } from 'rxjs/operators';

@Component({
	selector: 'app-language-toggle',
	templateUrl: './language-toggle.component.html',
	styleUrls: ['./language-toggle.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageToggleComponent implements OnDestroy {
	private readonly destroy$ = new Subject<void>();

	private readonly currentLangauge = new BehaviorSubject<'en' | 'es'>(
		this.translate.currentLang as any
	);

	public readonly currentLanguage$ = this.currentLangauge
		.asObservable()
		.pipe(takeUntil(this.destroy$), shareReplay(1));

	constructor(
		private readonly translate: TranslateService,
		private readonly analyticsService: Analytics
	) {}

	public ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	public toggleLanguage(event: any): void {
		const current = this.translate.currentLang;

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
		await this.translate.use(value).pipe(first()).toPromise();
		this.currentLangauge.next(value);
		await logEvent(this.analyticsService, 'set_language', { value });
	}
}
