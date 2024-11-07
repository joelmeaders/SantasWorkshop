import { Injectable } from '@angular/core';
import {
	distinctUntilChanged,
	filter,
	map,
	pluck,
	shareReplay,
	switchMap,
} from 'rxjs/operators';
import { from, Observable } from 'rxjs';
import {
	AuthWrapper,
	IdTokenResult,
	User,
	UserCredential,
} from './_auth-wrapper';
import { Auth, UserEmailUid } from '@santashop/models';
import { FunctionsWrapper } from './_functions-wrapper';

@Injectable({
	providedIn: 'root',
})
export class AuthService {
	/**
	 * Stream of the auth state, triggered on login/logout
	 *
	 * @type {(Observable<User | null>)}
	 * @memberof AuthService
	 */
	public readonly currentUser$: Observable<User | null> = this.authWrapper
		.authState()
		.pipe(distinctUntilChanged(), shareReplay(1));

	public readonly getCurrentUserToken = (): Promise<IdTokenResult | null> =>
		this.authWrapper.getCurrentUserToken();

	/**
	 * Stream of user email and uid
	 *
	 * @type {Observable<UserEmailUid>}
	 * @memberof AuthService
	 */
	public readonly emailAndUid$: Observable<UserEmailUid> =
		this.currentUser$.pipe(
			map(
				(res: any) =>
					({
						emailAddress: res?.email,
						uid: res?.uid,
					}) as UserEmailUid,
			),
			distinctUntilChanged(),
			shareReplay(1),
		);

	/**
	 * Stream of uid. Will not fire/complete if user is
	 * not logged in.
	 *
	 * @type {Observable<string>}
	 * @memberof AuthService
	 */
	public readonly uid$: Observable<string> = this.currentUser$.pipe(
		pluck('uid'),
		filter((uid) => !!uid),
		map((uid) => uid as string),
		shareReplay(1),
	);

	/**
	 * Checks token claims to see if the user has an admin
	 * claim. Will not fire/complete unless user is signed in.
	 *
	 * @memberof AuthService
	 */
	public readonly isAdmin$ = this.currentUser$.pipe(
		filter((user) => !!user),
		// TODO: Find alternative
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		switchMap((user) => from(user!.getIdTokenResult(false))),
		map((token) => token.claims?.['admin'] ?? false),
		shareReplay(1),
	);

	constructor(
		private readonly authWrapper: AuthWrapper,
		private readonly functionsWrapper: FunctionsWrapper,
	) {}

	/**
	 * Reset user password, sends an email.
	 *
	 * @param emailAddress
	 * @return
	 * @memberof AuthService
	 */
	public resetPassword(emailAddress: string): Promise<void> {
		// TODO: Add email validation
		return this.authWrapper.sendPasswordResetEmail(emailAddress);
	}

	/**
	 * Change user password. Logs in, then changes password.
	 *
	 * @param oldPassword
	 * @param newPassword
	 * @return
	 * @memberof AuthService
	 */
	public async changePassword(
		oldPassword: string,
		newPassword: string,
	): Promise<void> {
		const user = this.authWrapper.currentUser();

		if (!user) return Promise.reject(new Error('User cannot be null'));

		const auth: Auth = {
			emailAddress: user.email as string,
			password: oldPassword,
		};

		try {
			await this.login(auth);
			return await this.authWrapper.updatePassword(user, newPassword);
		} catch (error: any) {
			// await this.errorHandler.handleError(error);
			return Promise.reject(error);
		}
	}

	/**
	 * Changes the user email address. Logs the user
	 * in first, then changes their email address.
	 *
	 * @param password
	 * @param newEmailAddress
	 * @return
	 * @memberof AuthService
	 */
	public async changeEmailAddress(
		password: string,
		newEmailAddress: string,
	): Promise<void> {
		const user = await this.authWrapper.currentUser();

		if (!user) return Promise.reject(new Error('User cannot be null'));

		const auth: Auth = {
			emailAddress: user?.email as string,
			password,
		};

		try {
			await this.login(auth);
			await this.functionsWrapper.updateEmailAddress(newEmailAddress);
		} catch (error: any) {
			// await this.errorHandler.handleError(error);
			return Promise.reject(error);
		}
	}

	/**
	 * Logs the user in via email/password
	 *
	 * @param auth
	 * @return
	 * @memberof AuthService
	 */
	public async login(auth: Auth): Promise<UserCredential> {
		return this.authWrapper.signInWithEmailAndPassword(
			auth.emailAddress,
			auth.password,
		);
	}

	/**
	 * Logs the user out, then triggers browser reload.
	 *
	 * @param [reload=true]
	 * @return
	 * @memberof AuthService
	 */
	public async logout(reload = true): Promise<void> {
		await this.authWrapper.signOut().then(() => {
			// TODO: Replace this with something testable
			if (reload) document.location.reload();
		});
	}
}
