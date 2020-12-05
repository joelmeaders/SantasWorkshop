import { Injectable } from '@angular/core';
import { CanActivate, CanLoad, Route, UrlSegment, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { SignUpStatusService } from '../services/sign-up-status.service';

@Injectable({
  providedIn: 'root'
})
export class SignUpStatusGuard implements CanActivate, CanLoad {

  constructor(private readonly signUpStatusService: SignUpStatusService)
  { } 

  public canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.signUpStatusService.$signupEnabled;
  }
  public canLoad(route: Route, segments: UrlSegment[]): Observable<boolean> {
    return this.signUpStatusService.$signupEnabled;
  }
}
