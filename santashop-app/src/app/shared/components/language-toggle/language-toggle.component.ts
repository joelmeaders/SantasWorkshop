import { CustomerLanguageService } from '../../../core/services/customer-language.service';
import {
	ChangeDetectionStrategy,
	Component,
	inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';

import { IonText, IonToggle } from '@ionic/angular/standalone';

@Component({
	selector: 'app-language-toggle',
	templateUrl: './language-toggle.component.html',
	styleUrls: ['./language-toggle.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [IonToggle, IonText],
})
export class LanguageToggleComponent {
	private readonly translate = inject(TranslateService);
	private readonly language = inject(CustomerLanguageService);

	public readonly currentLanguage = toSignal(this.language.language$, {
		initialValue: 'en' as const,
	});

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
