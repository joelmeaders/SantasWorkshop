import { formatDate } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';
import { getDateTimezoneOffset } from '@santashop/models';

@Pipe({ name: 'eventDate', standalone: true })
export class EventDatePipe implements PipeTransform {
	public transform(
		value: Date | string | number | null | undefined,
		format = 'mediumDate',
		locale = 'en-US',
	): string | null {
		if (value == null || value === '') return null;
		const date = new Date(value);
		return formatDate(date, format, locale, getDateTimezoneOffset(date));
	}
}
