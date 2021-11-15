import { Pipe, PipeTransform } from '@angular/core';
import { IChild } from '@models/*';

@Pipe({
  name: 'childInitials'
})
export class ChildInitialsPipe implements PipeTransform {

  transform(value: IChild): string {
    return `${value.firstName.slice(0,1)}${value.lastName.slice(0,1)}`;
  }

}
