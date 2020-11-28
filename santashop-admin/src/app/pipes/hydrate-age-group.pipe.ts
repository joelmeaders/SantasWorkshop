import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'hydrateAgeGroup',
})
export class HydrateAgeGroupPipe implements PipeTransform {
  transform(value: string): string {
    switch (value) {
      case '0':
        return '0-2';

      case '3':
        return '3-5';

      case '6':
        return '6-8';

      case '9':
        return '9-11';
    }
  }
}
