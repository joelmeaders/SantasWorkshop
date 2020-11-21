import { Injectable, OnDestroy } from '@angular/core';
import { FirebaseApp } from '@angular/fire';
import { AngularFireAuth } from '@angular/fire/auth';
import { Router } from '@angular/router';
import 'firebase/auth';
import { user } from 'rxfire/auth';
import { Observable, of, Subject } from 'rxjs';
import { distinctUntilChanged, filter, map, mergeMap, publishReplay, refCount, switchMap, takeUntil, tap } from 'rxjs/operators';
import { UserProfile } from '../models/user-profile.model';
import { UserProfileService } from './user-profile.service';
import { AngularFireFunctions } from '@angular/fire/functions';


@Injectable({
  providedIn: 'root'
})
export class AuthService implements OnDestroy {

  private readonly $destroy = new Subject<void>();

  constructor(
    private readonly firebase: FirebaseApp,
    private readonly angularFireAuth: AngularFireAuth,
    private readonly angularFireFunctions: AngularFireFunctions, 
    private readonly userProfileService: UserProfileService,
    private readonly router: Router
  ) { }

  public readonly $currentUser = user(this.firebase.auth()).pipe(
    takeUntil(this.$destroy),
    distinctUntilChanged(),
    publishReplay(1),
    refCount()
  );

  public readonly $emailAndUid = this.$currentUser.pipe(
    takeUntil(this.$destroy),
    map((res: any) => ({ email: res?.email, id: res?.uid })),
    distinctUntilChanged(),
    publishReplay(1),
    refCount()
  )

  public readonly $userProfile: Observable<UserProfile> = this.$currentUser.pipe(
    takeUntil(this.$destroy),
    mergeMap(currentUser =>
      currentUser ? this.userProfileService.readOne(currentUser.uid) : of(undefined)),
    distinctUntilChanged(),
    publishReplay(1),
    refCount()
  );
  public readonly $isAdmin = this.$currentUser.pipe(
    takeUntil(this.$destroy),
    filter(user => !!user),
    switchMap(() => this.angularFireFunctions.httpsCallable('isAdmin')({})),
    map((response: boolean) => response),
    publishReplay(1),
    refCount()
  );

  public resetPassword(email: string) {
    return this.angularFireAuth.sendPasswordResetEmail(email);
  }

  public login(email: string, password: string) {
    return this.angularFireAuth.signInWithEmailAndPassword(email, password);
  }

  public async logout() {
    await this.angularFireAuth.signOut().then(() => this.router.navigate(['/']));
  }

  ngOnDestroy() {
    this.$destroy.next();
  }
}
