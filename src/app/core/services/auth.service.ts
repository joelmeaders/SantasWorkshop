import { Injectable, OnDestroy } from '@angular/core';
import { Subject, of, Observable, BehaviorSubject } from 'rxjs';
import { takeUntil, publishReplay, refCount, defaultIfEmpty, mergeMap, distinctUntilChanged, mapTo } from 'rxjs/operators';
import { Router } from '@angular/router';
import { UserProfileService } from './http/user-profile.service';

import 'firebase/auth';
import { FirebaseApp } from '@angular/fire';
import { AngularFireAuth } from '@angular/fire/auth';
import { authState } from 'rxfire/auth';
import { UserProfile } from '@app/core/models/user-profile.model';


@Injectable({
  providedIn: 'root'
})
export class AuthService implements OnDestroy {

  private readonly $destroy = new Subject<void>();

  constructor(
    private readonly firebase: FirebaseApp,
    private readonly angularFireAuth: AngularFireAuth,
    private readonly userProfileService: UserProfileService,
    private readonly router: Router
  ) { }

  public readonly $currentUser = authState(this.firebase.auth()).pipe(
    takeUntil(this.$destroy),
    distinctUntilChanged(),
    publishReplay(1),
    refCount()
  );

  public readonly $userProfile: Observable<UserProfile> = this.$currentUser.pipe(
    takeUntil(this.$destroy),
    mergeMap(currentUser =>
      currentUser ? this.userProfileService.readOne(currentUser.uid) : of(undefined)),
    distinctUntilChanged(),
    publishReplay(1),
    refCount()
  );

  public readonly $isAdmin = this.$userProfile.pipe(
    takeUntil(this.$destroy),
    // TODO
    // map(userProfile => userProfile.roles && userProfile.roles.administrator),
    mapTo(false),
    defaultIfEmpty(false),
    publishReplay(1),
    refCount()
  );

  public resetPassword(email: string) {
    return this.angularFireAuth.sendPasswordResetEmail(email);
  }

  public login(email: string, password: string) {
    return this.angularFireAuth.signInWithEmailAndPassword(email, password);
    // TODO: analytics
    //  () => firebase.analytics().logEvent('login', { type: 'email'})
  }

  public async logout() {
    await this.angularFireAuth.signOut().then(() => this.router.navigate(['/']));
  }

  ngOnDestroy() {
    this.$destroy.next();
  }
}
