import { Pipe, PipeTransform, inject } from '@angular/core';
import { AdminLanguageService } from './admin-language.service';
@Pipe({ name: 'adminTimeSlot', standalone: true, pure: false })
export class AdminTimeSlotPipe implements PipeTransform {
	private readonly language = inject(AdminLanguageService);
	public transform(value: Date | string | number | null | undefined): string {
		if (value == null || value === '') return '';
		const start = new Date(value);
		const end = new Date(start.getTime() + 60 * 60 * 1000);
		const formatter = new Intl.DateTimeFormat(this.language.locale(), {
			timeZone: 'America/Denver',
			hour: 'numeric',
			minute: '2-digit',
		});
		return formatter.format(start) + ' – ' + formatter.format(end);
	}
}
