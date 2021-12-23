import { Injectable } from '@angular/core';
import { distinctUntilChanged, filter, map, pluck, shareReplay, switchMap } from 'rxjs/operators';
import { from, Observable } from 'rxjs';
import { ErrorHandlerService } from './error-handler.service';
import { IAuth, IUserEmailUid } from '@models/*';

import { Auth, authState, signInWithEmailAndPassword, UserCredential, sendPasswordResetEmail, updatePassword, User } from '@angular/fire/auth';
import { traceUntilFirst } from '@angular/fire/performance';
import { Functions, httpsCallable } from '@angular/fire/functions';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  public readonly currentUser$: Observable<User | null> = authState(this.angularFireAuth).pipe(
    distinctUntilChanged(),
    traceUntilFirst('auth'),
    shareReplay(1)
  );

  public readonly emailAndUid$: Observable<IUserEmailUid> = this.currentUser$.pipe(
    map((res: any) => ({ emailAddress: res?.email, uid: res?.uid }) as IUserEmailUid),
    distinctUntilChanged(),
    shareReplay(1)
  );

  public readonly uid$: Observable<string> = this.currentUser$.pipe(
    pluck('uid'),
    filter(uid => !!uid),
    map(uid => uid as string),
    shareReplay(1)
  );

  public readonly isAdmin$ = this.currentUser$.pipe(
    switchMap(user => from(user!.getIdTokenResult())),
    map(token => token.claims.admin),
    shareReplay(1)
  );

  constructor(
    private readonly angularFireAuth: Auth,
    private readonly angularFireFunctions: Functions,
    private readonly errorHandler: ErrorHandlerService
  ) { }

  public resetPassword(email: string): Promise<void> {
    return sendPasswordResetEmail(this.angularFireAuth, email);
  }

  public async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const user = this.angularFireAuth.currentUser;

    // TODO: Throw error here
    if (!user)
      return;

    const auth: IAuth = {
      emailAddress: user?.email as string,
      password: oldPassword
    }

    try {
      await this.login(auth);
      return updatePassword(user, newPassword)
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

    const accountStatusFunction = httpsCallable(this.angularFireFunctions, 'updateEmailAddress');

    try {
      await this.login(auth);
      await accountStatusFunction({emailAddress:newEmailAddress});
      return Promise.resolve();
    }
    catch (error: any) {
      await this.errorHandler.handleError(error);
      return Promise.reject(error);
    }
  }

  public async login(auth: IAuth): Promise<UserCredential> {
    return signInWithEmailAndPassword(this.angularFireAuth, auth.emailAddress, auth.password)
  }

  public async logout(): Promise<void> {
    await this.angularFireAuth.signOut()
      .then(() => document.location.reload());
  }
}
