import { Injectable, OnDestroy } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { Router } from '@angular/router';
import 'firebase/auth';
import { Observable, of, Subject } from 'rxjs';
import { distinctUntilChanged, filter, map, publishReplay, refCount, switchMap, takeUntil } from 'rxjs/operators';
import { UserProfile } from '../models/user-profile.model';
import { AngularFireFunctions } from '@angular/fire/functions';
import { FireCRUDStateless } from './fire-crud.service';


@Injectable({
  providedIn: 'root'
})
export class AuthService implements OnDestroy {

  private readonly PROFILE_COLLECTION = 'customers';
  private readonly $destroy = new Subject<void>();

  constructor(
    private readonly angularFireAuth: AngularFireAuth,
    private readonly angularFireFunctions: AngularFireFunctions,
    private readonly httpService: FireCRUDStateless,
    private readonly router: Router
  ) { }

  public readonly $currentUser = this.angularFireAuth.user.pipe(
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
  );

  public readonly $userProfile: Observable<UserProfile> = this.$emailAndUid.pipe(
    takeUntil(this.$destroy),
    switchMap(currentUser =>
      currentUser ? this.getProfile(currentUser.id) : of(undefined)),
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

  private readonly getProfile = (uid: string) =>
    this.httpService.readOne<UserProfile>(this.PROFILE_COLLECTION, uid, 'id')

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
