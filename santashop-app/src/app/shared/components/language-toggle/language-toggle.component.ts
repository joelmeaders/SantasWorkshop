import { CustomerLanguageService } from '../../../core/services/customer-language.service';
import {
	ChangeDetectionStrategy,
	Component,
	OnDestroy,
	inject,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { shareReplay, takeUntil } from 'rxjs/operators';

import { AsyncPipe } from '@angular/common';
import { IonText, IonToggle } from '@ionic/angular/standalone';

@Component({
	selector: 'app-language-toggle',
	templateUrl: './language-toggle.component.html',
	styleUrls: ['./language-toggle.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [IonToggle, IonText, AsyncPipe, IonText, IonToggle],
})
export class LanguageToggleComponent implements OnDestroy {
	private readonly translate = inject(TranslateService);
	private readonly language = inject(CustomerLanguageService);

	private readonly destroy$ = new Subject<void>();

	public readonly currentLanguage$ = this.language.language$.pipe(
		takeUntil(this.destroy$),
		shareReplay(1),
	);

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
		await this.language.setLanguage(value);
	}
}
