import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AdminLanguageService } from './admin-language.service';
import { AdminThemeService, type AdminTheme } from './admin-theme.service';
import { AdminTextPipe } from './admin-text.pipe';

@Component({
	selector: 'admin-preferences',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [AdminTextPipe],
	template: `
		<div class="preferences">
			<div
				class="language-choice"
				role="group"
				[attr.aria-label]="'Language' | adminText"
			>
				<button
					type="button"
					[attr.aria-pressed]="language.language() === 'en'"
					(click)="language.setLanguage('en')"
					lang="en"
				>
					English
				</button>
				<button
					type="button"
					[attr.aria-pressed]="language.language() === 'es'"
					(click)="language.setLanguage('es')"
					lang="es"
				>
					Español
				</button>
			</div>
			<label class="appearance">
				<span class="visually-hidden">{{
					'Appearance' | adminText
				}}</span>
				<select [value]="theme.theme()" (change)="changeTheme($event)">
					<option value="system">{{ 'System' | adminText }}</option>
					<option value="light">{{ 'Light' | adminText }}</option>
					<option value="dark">{{ 'Dark' | adminText }}</option>
				</select>
			</label>
		</div>
		@if (language.loadFailed()) {
			<p role="status">
				{{ 'Language could not be loaded. Try again.' | adminText }}
			</p>
		}
	`,
	styles: `
		:host {
			display: block;
		}
		.preferences {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			flex-wrap: wrap;
		}
		.language-choice {
			display: flex;
			border: 1px solid var(--admin-border);
			border-radius: 10px;
			overflow: hidden;
		}
		button,
		select {
			min-height: 44px;
			border: 0;
			padding: 0.6rem 0.7rem;
			font: inherit;
			font-size: 0.8125rem;
			color: var(--ion-text-color);
			background: var(--admin-surface);
			cursor: pointer;
		}
		button[aria-pressed='true'] {
			color: var(--admin-accent);
			background: var(--admin-accent-soft);
			font-weight: 700;
		}
		select {
			border: 1px solid var(--admin-border);
			border-radius: 10px;
			max-width: 8rem;
		}
		.visually-hidden {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
		}
	`,
})
export class AdminPreferencesComponent {
	public readonly language = inject(AdminLanguageService);
	public readonly theme = inject(AdminThemeService);
	public changeTheme(event: Event): void {
		this.theme.setTheme(
			(event.target as HTMLSelectElement).value as AdminTheme,
		);
	}
}
