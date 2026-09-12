import { formatDate } from '@angular/common';
import './admin-date.pipe';
import { Pipe, PipeTransform, inject } from '@angular/core';
import { AdminLanguageService } from './admin-language.service';
@Pipe({ name: 'adminCalendarDate', standalone: true, pure: false })
export class AdminCalendarDatePipe implements PipeTransform {
	private readonly language = inject(AdminLanguageService);
	public transform(value: string | null | undefined): string {
		return value
			? formatDate(value, 'mediumDate', this.language.locale())
			: '';
	}
}
