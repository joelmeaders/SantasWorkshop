import { Injectable } from '@angular/core';
import { ReplaySubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RouterParamService {

  constructor() { }

  public readonly $currentParameter = new ReplaySubject<string>(1);

  public setParameter(param?: string) {
    if (!param) {
      return;
    }
    this.$currentParameter.next(param);
  }
}
