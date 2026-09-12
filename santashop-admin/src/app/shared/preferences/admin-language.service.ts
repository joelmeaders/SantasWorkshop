import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import {
	readAdminPreference,
	saveAdminPreference,
} from './admin-theme.service';

export type AdminLanguage = 'en' | 'es';

@Injectable({ providedIn: 'root' })
export class AdminLanguageService {
	private readonly translate = inject(TranslateService);
	public readonly language = signal<AdminLanguage>('en');
	public readonly changing = signal(false);
	public readonly loadFailed = signal(false);
	private sequence = 0;
	private sources = new Map<string, string>();

	public async initialize(): Promise<void> {
		await this.setLanguage(
			readAdminPreference('santashop-admin-language') === 'es'
				? 'es'
				: 'en',
		);
	}

	public async setLanguage(language: AdminLanguage): Promise<void> {
		const sequence = ++this.sequence;
		this.changing.set(true);
		this.loadFailed.set(false);
		try {
			const dictionary = await firstValueFrom(
				this.translate.use(language),
			);
			if (sequence !== this.sequence) return;
			this.sources = new Map(
				Object.entries(dictionary)
					.filter(
						(entry): entry is [string, string] =>
							typeof entry[1] === 'string',
					)
					.map(([key, value]) => [value, key]),
			);
			this.language.set(language);
			document.documentElement.lang = language;
			saveAdminPreference('santashop-admin-language', language);
		} catch {
			if (sequence === this.sequence) this.loadFailed.set(true);
		} finally {
			if (sequence === this.sequence) this.changing.set(false);
		}
	}

	/** English source phrases are dictionary keys and readable fallbacks. */
	public text(source: string, params?: Record<string, unknown>): string {
		this.language();
		if (!source) return source;
		// Template formatting may wrap a source phrase onto several lines.
		const key = source.replace(/\s+/g, ' ').trim()
			.replace(/\{\{\s*(\w+)\s*\}\}/g, '{{$1}}');
		if (!key) return source;
		const translated = this.translate.instant(key, params) as string;
		if (translated !== key) return translated;
		return params
			? source.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string): string =>
					String(params[name] ?? ''),
				)
			: source;
	}

	public source(value: string): string {
		return this.sources.get(value) ?? value;
	}

	public locale(): string {
		return this.language() === 'es' ? 'es-US' : 'en-US';
	}
}
