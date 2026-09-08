import { Injectable, inject } from '@angular/core';
import {
	distinctUntilChanged,
	filter,
	map,
	shareReplay,
	switchMap,
} from 'rxjs/operators';
import { from, merge, Observable, Subject } from 'rxjs';
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
	private readonly refreshedUser$ = new Subject<User | null>();

	/**
	 * Stream of the current identity, triggered on auth state and refreshes
	 *
	 * @type {(Observable<User | null>)}
	 * @memberof AuthService
	 */
	public readonly currentUser$: Observable<User | null> = merge(
		this.authWrapper.authState().pipe(distinctUntilChanged()),
		this.refreshedUser$,
	).pipe(shareReplay(1));

	public async refreshCurrentUser(): Promise<User | null> {
		const user = await this.authWrapper.reloadCurrentUser();
		this.refreshedUser$.next(user);
		return user;
	}

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
		distinctUntilChanged(),
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
				(Array.isArray(token.claims?.['roles']) &&
					token.claims['roles'].includes('admin')),
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
				roles.includes('admin') ||
				roles.includes('checkin')
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
				if (claims['owner'] === true) {
					return true;
				}
				const roles =
					(claims['roles'] as StaffRole[] | undefined) ?? [];
				return roles.includes('admin') || roles.includes(role);
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

	/** Requests password recovery without disclosing whether the account exists. */
	public async resetPassword(emailAddress: string): Promise<void> {
		await this.functionsWrapper.requestPasswordReset(emailAddress);
	}

	/**
	 * Change user password. Refreshes the identity, logs in, then changes password.
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

		const currentUser = (await this.refreshCurrentUser()) ?? user;

		const auth: Auth = {
			emailAddress: currentUser.email as string,
			password: oldPassword,
		};

		const credential = await this.login(auth);
		return this.authWrapper.updatePassword(
			credential.user ?? this.authWrapper.currentUser() ?? currentUser,
			newPassword,
		);
	}

	/**
	 * Changes the user email address. Refreshes the identity, logs the user
	 * in, changes the email address, then refreshes the identity again.
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

		const currentUser = (await this.refreshCurrentUser()) ?? user;

		const auth: Auth = {
			emailAddress: currentUser.email as string,
			password,
		};

		await this.login(auth);
		await this.functionsWrapper.updateEmailAddress(newEmailAddress);
		await this.login({ emailAddress: newEmailAddress, password });
		await this.refreshCurrentUser();
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
