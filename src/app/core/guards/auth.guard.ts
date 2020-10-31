import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, CanLoad, Route, UrlSegment, Router } from '@angular/router';
import { UserProfile } from '@app/core/models/user-profile.model';
import { AuthService } from '@app/core/services/auth.service';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanActivateChild, CanLoad {

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) { }

  public canLoad(route: Route, segments: UrlSegment[]): Observable<boolean> {
    return this.isAuthenticated();
  }

  public canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.isAuthenticated();
  }

  public canActivateChild(next: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.isAuthenticated();
  }

  private isAuthenticated() {
    return this.authService.$userProfile.pipe(
      map((user: UserProfile) => !!user ? true : false),
      // tap(isAuth => {
      //   if (!isAuth) {
      //     this.router.navigate(['/']);
      //   }
      // })
    );
  }

  
  
}
