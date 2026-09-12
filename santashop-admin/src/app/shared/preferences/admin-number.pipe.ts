import { formatNumber } from '@angular/common';
import { Pipe, PipeTransform, inject } from '@angular/core';
import { AdminLanguageService } from './admin-language.service';

@Pipe({ name: 'adminNumber', standalone: true, pure: false })
export class AdminNumberPipe implements PipeTransform {
	private readonly language = inject(AdminLanguageService);
	public transform(
		value: number | string | null | undefined,
		digitsInfo?: string,
	): string | null {
		return value == null
			? null
			: formatNumber(Number(value), this.language.locale(), digitsInfo);
	}
}
