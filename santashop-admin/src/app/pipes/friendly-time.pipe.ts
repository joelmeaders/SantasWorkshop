import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'friendlyTime',
})
export class FriendlyTimePipe implements PipeTransform {
  transform(value: number, ...args: unknown[]): unknown {
    switch (value) {
      case 10: return '10AM';
      case 11: return '11AM';
      case 12: return '12PM';
      case 13: return '1PM';
      case 14: return '2PM';
      case 15: return '3PM';
      default:
        break;
    }
  }
}
