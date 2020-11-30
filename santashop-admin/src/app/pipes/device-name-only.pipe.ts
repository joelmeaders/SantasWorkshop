import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'deviceNameOnly'
})
export class DeviceNameOnlyPipe implements PipeTransform {

  transform(value: string): string {
    return value.split(' (')[0];
  }

}
