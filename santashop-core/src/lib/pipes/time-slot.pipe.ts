import { Pipe, PipeTransform } from '@angular/core';
import { DatePipe } from '@angular/common';

@Pipe({
	name: 'timeSlot',
	standalone: true,
})
export class TimeSlotPipe implements PipeTransform {
	private datePipe = new DatePipe('en-US');

	public transform(date: Date | string | number, timezone?: string): string {
		if (!date) return '';

		const startTime = new Date(date);
		const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Add 1 hour

		const startFormatted = this.datePipe.transform(
			startTime,
			'ha',
			timezone,
		);
		const endFormatted = this.datePipe.transform(endTime, 'ha', timezone);

		return `${startFormatted} - ${endFormatted}`;
	}
}
