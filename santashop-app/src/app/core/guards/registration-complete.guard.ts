import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { PreRegistrationService } from '../services/pre-registration.service';

@Injectable({
  providedIn: 'root',
})
export class RegistrationCompleteGuard implements CanActivate {
  constructor(
    private readonly service: PreRegistrationService,
    private readonly router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.service.registrationComplete$.pipe(
      take(1),
      map((isComplete) =>
        isComplete
          ? this.router.parseUrl('pre-registration/confirmation')
          : true
      )
    );
  }
}
