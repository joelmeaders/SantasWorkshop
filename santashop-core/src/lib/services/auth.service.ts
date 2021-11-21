import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { distinctUntilChanged, filter, map, pluck, publishReplay, refCount, shareReplay, switchMap, take } from 'rxjs/operators';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { from, Observable } from 'rxjs';
import { ErrorHandlerService } from './error-handler.service';
import firebase from 'firebase/compat/app';
import { IAuth, IUserEmailUid } from '@models/*';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(
    private readonly angularFireAuth: AngularFireAuth,
    private readonly angularFireFunctions: AngularFireFunctions,
    private readonly errorHandler: ErrorHandlerService
  ) { }

  public readonly currentUser$ = this.angularFireAuth.user.pipe(
    distinctUntilChanged(),
    publishReplay(1),
    refCount()
  );

  public readonly emailAndUid$: Observable<IUserEmailUid> = this.currentUser$.pipe(
    map((res: any) => ({ emailAddress: res?.email, uid: res?.uid }) as IUserEmailUid),
    distinctUntilChanged(),
    publishReplay(1),
    refCount()
  );

  public readonly uid$: Observable<string> = this.currentUser$.pipe(
    pluck('uid'),
    filter(uid => !!uid),
    map(uid => uid as string),
    publishReplay(1),
    refCount()
  );

  public readonly isAdmin$ = this.currentUser$.pipe(
    switchMap(user => from(user!.getIdTokenResult())),
    map(token => token.claims.admin),
    shareReplay(1)
  );

  public resetPassword(email: string): Promise<void> {
    return this.angularFireAuth.sendPasswordResetEmail(email);
  }

  public async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.angularFireAuth.currentUser;
    const auth: IAuth = {
      emailAddress: user?.email as string,
      password: oldPassword
    }

    try {
      await this.login(auth);
      await user?.updatePassword(newPassword)
      return Promise.resolve();
    }
    catch (error: any) {
      await this.errorHandler.handleError(error);
      return Promise.reject(error);
    }
  }

  public async changeEmailAddress(password: string, newEmailAddress: string): Promise<void> {

    
    const user = await this.angularFireAuth.currentUser;
    const auth: IAuth = {
      emailAddress: user?.email as string,
      password
    }

    const accountStatusFunction = this.angularFireFunctions.httpsCallable('updateEmailAddress');

    try {
      await this.login(auth);

      await accountStatusFunction({emailAddress:newEmailAddress})
        .pipe(take(1)).toPromise();

      return Promise.resolve();
    }
    catch (error: any) {
      await this.errorHandler.handleError(error);
      return Promise.reject(error);
    }
  }

  public async login(auth: IAuth): Promise<firebase.auth.UserCredential> {
    return this.angularFireAuth.signInWithEmailAndPassword(auth.emailAddress, auth.password);
  }

  public async logout(): Promise<void> {
    await this.angularFireAuth.signOut();
    document.location.reload();
  }
}
