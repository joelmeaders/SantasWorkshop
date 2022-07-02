import { Injectable, OnDestroy } from '@angular/core';
import { shareReplay, Subject } from 'rxjs';
import { AuthWrapper, User, UserCredential } from './_auth-wrapper';
import { FunctionsWrapper } from './_functions-wrapper';

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

	public readonly authState$ = this.authWrapper
		.authState()
		.pipe(shareReplay(1));

	constructor(
		private readonly authWrapper: AuthWrapper,
		private readonly functionsWrapper: FunctionsWrapper
	) {}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	public currentUser(): User | null {
		return this.authWrapper.currentUser();
	}

	public sendPasswordResetEmail(emailAddress: string) {
		return this.authWrapper.sendPasswordResetEmail(emailAddress);
	}

	public signInWithEmailAndPassword(
		emailAddress: string,
		password: string
	): Promise<UserCredential> {
		return this.authWrapper.signInWithEmailAndPassword(
			emailAddress,
			password
		);
	}

	public updateUserPassword(user: User, newPassword: string): Promise<void> {
		return this.authWrapper.updatePassword(user, newPassword);
	}

	public async updateUserEmailAddress(
		newEmailAddress: string
	): Promise<void> {
		await this.functionsWrapper.updateEmailAddress(newEmailAddress);
	}

	public signOut(): Promise<void> {
		return this.authWrapper.signOut();
	}
}
