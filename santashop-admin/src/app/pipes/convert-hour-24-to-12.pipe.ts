import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
	name: 'convertHour24To12',
})
export class ConvertHour24To12Pipe implements PipeTransform {
	transform(hour: number): string {
		const postfix = hour >= 12 ? 'PM' : 'AM';
		const hourfix = hour > 12 ? hour - 12 : hour;
		return `${hourfix === 0 ? 12 : hourfix}${postfix}`;
	}
}
