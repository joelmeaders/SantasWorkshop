import { updateAlertInputLabels } from './admin-overlays';
import { DestroyRef, Injectable, effect, inject } from '@angular/core';
import { AdminLanguageService } from './admin-language.service';

/** Ionic select creates its own alerts without Angular's AlertController. */
@Injectable({ providedIn: 'root' })
export class AdminSelectLanguageService {
	private readonly language = inject(AdminLanguageService);
	private readonly active = new Set<() => void>();

	constructor() {
		const onPresent = (event: Event): void => {
			const alert = event.target as HTMLIonAlertElement;
			if (
				alert.tagName !== 'ION-ALERT' ||
				!alert.classList.contains('select-alert')
			)
				return;
			const header = this.language.source(alert.header ?? '');
			const buttons = alert.buttons.map((button) =>
				typeof button === 'string'
					? this.language.source(button)
					: { ...button, text: this.language.source(button.text) },
			);
			const labels = alert.inputs.map((input) =>
				this.language.source(input.label ?? ''),
			);
			const update = (): void => {
				alert.header = this.language.text(header);
				alert.buttons = buttons.map((button) =>
					typeof button === 'string'
						? this.language.text(button)
						: { ...button, text: this.language.text(button.text) },
				);
				updateAlertInputLabels(
					alert,
					labels.map((label) => ({
						label: this.language.text(label),
					})),
				);
			};
			this.active.add(update);
			void alert.onDidDismiss().then(() => this.active.delete(update));
		};
		document.addEventListener('ionAlertWillPresent', onPresent);
		inject(DestroyRef).onDestroy(() =>
			document.removeEventListener('ionAlertWillPresent', onPresent),
		);
		effect(() => {
			this.language.language();
			this.active.forEach((update) => update());
		});
	}
}
