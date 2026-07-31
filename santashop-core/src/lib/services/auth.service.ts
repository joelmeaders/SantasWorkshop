import { Injectable, inject } from '@angular/core';
import {
	distinctUntilChanged,
	filter,
	map,
	shareReplay,
	switchMap,
} from 'rxjs/operators';
import { from, Observable } from 'rxjs';
import { AuthWrapper } from './_auth-wrapper';
import { Auth, StaffRole, UserEmailUid } from '@santashop/models';
import { FunctionsWrapper } from './_functions-wrapper';
import {
	type IdTokenResult,
	type User,
	type UserCredential,
} from 'firebase/auth';

@Injectable({
	providedIn: 'root',
})
export class AuthService {
	private readonly authWrapper = inject(AuthWrapper);
	private readonly functionsWrapper = inject(FunctionsWrapper);

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
		map((user) => user?.uid),
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
		switchMap((user) => from(user.getIdTokenResult(false))),
		map(
			(token) =>
				token.claims?.['owner'] === true ||
				token.claims?.['admin'] === true,
		),
		shareReplay(1),
	);

	public readonly isOwner$ = this.currentUser$.pipe(
		filter((user) => !!user),
		switchMap((user) => from(user.getIdTokenResult(false))),
		map((token) => token.claims?.['owner'] === true),
		shareReplay(1),
	);

	/**
	 * Stream of the elevated roles assigned to the current user via
	 * custom claims. Emits an empty array when no roles are present.
	 * Will not fire/complete unless user is signed in.
	 *
	 * @memberof AuthService
	 */
	public readonly roles$: Observable<StaffRole[]> = this.currentUser$.pipe(
		filter((user) => !!user),
		switchMap((user) => from(user.getIdTokenResult(false))),
		map((token) => (token.claims?.['roles'] as StaffRole[]) ?? []),
		shareReplay(1),
	);

	/**
	 * Checks token claims to see if the user can perform check-in work.
	 * Admins implicitly satisfy this role.
	 *
	 * @memberof AuthService
	 */
	public readonly isCheckin$ = this.hasRole('checkin').pipe(shareReplay(1));

	/**
	 * Checks token claims to see if the user holds any elevated role
	 * (admin or a named role). Used to gate access to the admin app.
	 * Will not fire/complete unless user is signed in.
	 *
	 * @memberof AuthService
	 */
	public readonly isElevated$: Observable<boolean> = this.currentUser$.pipe(
		filter((user) => !!user),
		switchMap((user) => from(user.getIdTokenResult(false))),
		map((token) => {
			const claims = token.claims ?? {};
			const roles = (claims['roles'] as StaffRole[] | undefined) ?? [];
			return (
				claims['owner'] === true ||
				claims['admin'] === true ||
				roles.length > 0
			);
		}),
		shareReplay(1),
	);

	/**
	 * Checks token claims to see if the current user has the given role.
	 * Admins implicitly satisfy every role.
	 *
	 * @param role
	 * @return
	 * @memberof AuthService
	 */
	public hasRole(role: StaffRole): Observable<boolean> {
		return this.currentUser$.pipe(
			filter((user) => !!user),
			switchMap((user) => from(user.getIdTokenResult(false))),
			map((token) => {
				const claims = token.claims ?? {};
				if (
					claims['owner'] === true ||
					claims['admin'] === true
				) {
					return true;
				}
				const roles =
					(claims['roles'] as StaffRole[] | undefined) ?? [];
				return roles.includes(role);
			}),
			shareReplay(1),
		);
	}

	public async reauthenticate(password: string): Promise<void> {
		const user = this.authWrapper.currentUser();
		if (!user) {
			throw new Error('User must be signed in.');
		}

		await this.authWrapper.reauthenticateWithPassword(user, password);
		await user.getIdToken(true);
	}

	/**
	 * Reset user password, sends an email.
	 *
	 * @param emailAddress
	 * @return
	 * @memberof AuthService
	 */
	public resetPassword(emailAddress: string): Promise<void> {
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

		if (!user) throw new Error('User cannot be null');

		const auth: Auth = {
			emailAddress: user.email as string,
			password: oldPassword,
		};

		await this.login(auth);
		return this.authWrapper.updatePassword(user, newPassword);
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
		const user = this.authWrapper.currentUser();

		if (!user) throw new Error('User cannot be null');

		const auth: Auth = {
			emailAddress: user?.email as string,
			password,
		};

		await this.login(auth);
		await this.functionsWrapper.updateEmailAddress(newEmailAddress);
	}

	/**
	 * Logs the user in via email/password
	 *
	 * @param auth
	 * @return
	 * @memberof AuthService
	 */
	public login(auth: Auth): Promise<UserCredential> {
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
			if (reload) document.location.reload();
		});
	}
}
