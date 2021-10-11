import { Injectable } from '@angular/core';
import { CanActivate, CanLoad, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RemoteConfigService } from '../services/remote-config.service';

@Injectable({
  providedIn: 'root'
})
export class SignUpStatusGuard implements CanActivate, CanLoad {

  constructor(
    private readonly signUpStatusService: RemoteConfigService,
    private readonly router: Router
  ) { } 

  public canActivate(): Observable<boolean | UrlTree> {
    return this.signupEnabled();
  }
  public canLoad(): Observable<boolean | UrlTree> {
    return this.signupEnabled();
  }

  private readonly signupEnabled = () => 
    this.signUpStatusService.signupEnabled$.pipe(
      map(enabled => enabled || this.router.parseUrl('/registration-closed'))
    )
}
