import { Pipe, PipeTransform, inject } from '@angular/core';
import { AdminLanguageService } from './admin-language.service';

@Pipe({ name: 'adminText', standalone: true, pure: false })
export class AdminTextPipe implements PipeTransform {
	private readonly language = inject(AdminLanguageService);
	public transform(
		value: string | number | (() => string) | null | undefined,
		params?: Record<string, unknown>,
	): string {
		if (value == null) return '';
		if (typeof value === 'function') return value();
		if (typeof value === 'number')
			return new Intl.NumberFormat(this.language.locale()).format(value);
		return this.language.text(value, params);
	}
}
