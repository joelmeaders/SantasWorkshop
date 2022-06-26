import { Injectable, OnDestroy } from '@angular/core';
import {
  Auth,
  authState,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updatePassword,
  User,
  UserCredential,
} from '@angular/fire/auth';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { shareReplay, Subject } from 'rxjs';

/**
 * This class abstracts firebase auth methods
 * away from the rest of the app.
 *
 * @export
 * @class AfAuthService
 */
@Injectable({
  providedIn: 'root',
})
export class AfAuthService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();

  public readonly authState$ = authState(this.afAuth).pipe(shareReplay(1));

  constructor(
    private readonly afAuth: Auth,
    private readonly afFunctions: Functions
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public currentUser(): User | null {
    return this.afAuth.currentUser;
  }

  public sendPasswordResetEmail(emailAddress: string) {
    return sendPasswordResetEmail(this.afAuth, emailAddress);
  }

  public signInWithEmailAndPassword(
    emailAddress: string,
    password: string
  ): Promise<UserCredential> {
    return signInWithEmailAndPassword(this.afAuth, emailAddress, password);
  }

  public updateUserPassword(user: User, newPassword: string): Promise<void> {
    return updatePassword(user, newPassword);
  }

  public async updateUserEmailAddress(newEmailAddress: string): Promise<void> {
    const accountStatusFunction = httpsCallable(
      this.afFunctions,
      'updateEmailAddress'
    );
    await accountStatusFunction({ emailAddress: newEmailAddress });
  }

  public signOut(): Promise<void> {
    return this.afAuth.signOut();
  }
}
