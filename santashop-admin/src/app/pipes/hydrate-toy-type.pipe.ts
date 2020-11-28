import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'hydrateToyType',
})
export class HydrateToyTypePipe implements PipeTransform {
  transform(value: string): string {
    switch (value) {
      case 'i':
        return 'Infant';

      case 'b':
        return 'Boy';

      case 'g':
        return 'Girl';
    }
  }
}
