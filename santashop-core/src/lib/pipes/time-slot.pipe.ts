import { Pipe, PipeTransform } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EVENT_TIME_ZONE, getDateTimezoneOffset } from '@santashop/models';

@Pipe({
	name: 'timeSlot',
	standalone: true,
})
export class TimeSlotPipe implements PipeTransform {
	private readonly datePipe = new DatePipe('en-US');

	public transform(
		date: Date | string | number | null | undefined,
		timezone = EVENT_TIME_ZONE,
	): string {
		if (date == null || date === '') return '';

		const startTime = new Date(date);
		const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Add 1 hour

		const startFormatted = this.datePipe.transform(
			startTime,
			'ha',
			timezone.includes('/')
				? getDateTimezoneOffset(startTime, timezone)
				: timezone,
		);
		const endFormatted = this.datePipe.transform(
			endTime,
			'ha',
			timezone.includes('/')
				? getDateTimezoneOffset(endTime, timezone)
				: timezone,
		);

		return `${startFormatted} - ${endFormatted}`;
	}
}
