import { formatDate, registerLocaleData } from '@angular/common';
import spanish from '@angular/common/locales/es-US';
import { Pipe, PipeTransform, inject } from '@angular/core';
import { getDateTimezoneOffset } from '@santashop/models';
import { AdminLanguageService } from './admin-language.service';

registerLocaleData(spanish, 'es-US');

@Pipe({ name: 'adminDate', standalone: true, pure: false })
export class AdminDatePipe implements PipeTransform {
	private readonly language = inject(AdminLanguageService);
	public transform(
		value: Date | string | number | null | undefined,
		format = 'mediumDate',
	): string | null {
		if (value == null || value === '') return null;
		const date = new Date(value);
		return formatDate(
			date,
			format,
			this.language.locale(),
			getDateTimezoneOffset(date),
		);
	}
}
