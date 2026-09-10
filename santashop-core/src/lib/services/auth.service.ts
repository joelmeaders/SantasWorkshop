import { Injectable, inject } from '@angular/core';
import {
	distinctUntilChanged,
	filter,
	catchError,
	startWith,
	map,
	shareReplay,
	switchMap,
} from 'rxjs/operators';
import { defer, of, merge, Observable, Subject } from 'rxjs';
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
	public readonly emailAndUid$: Observable<UserEmailUid | null> =
		this.currentUser$.pipe(
			map((user) =>
				user ? { emailAddress: user.email, uid: user.uid } : null,
			),
			distinctUntilChanged(),
			shareReplay(1),
		);

	/** No identity is emitted until the SDK has finished initializing. */
	public readonly uid$: Observable<string | null> = this.currentUser$.pipe(
		map((user) => user?.uid ?? null),
		distinctUntilChanged(),
		shareReplay(1),
	);

	/** Pending claims clear visible privileges. Guards use claimsResolved$. */
	private readonly claimsState$ = this.currentUser$.pipe(
		switchMap((user) =>
			user
				? defer(() => user.getIdTokenResult(false)).pipe(
						map((token) => ({
							loading: false,
							claims: token.claims,
						})),
						catchError(() => of({ loading: false, claims: null })),
						startWith({ loading: true, claims: null }),
					)
				: of({ loading: false, claims: null }),
		),
		shareReplay(1),
	);
	public readonly claimsResolved$ = this.claimsState$.pipe(
		filter((state) => !state.loading),
		map((state) => state.claims),
	);
	private readonly claims$ = this.claimsState$.pipe(
		map((state) => state.claims),
	);
	public readonly isAdmin$ = this.hasRole('admin');
	public readonly isOwner$ = this.claims$.pipe(
		map((claims) => claims?.['owner'] === true),
	);
	public readonly roles$: Observable<StaffRole[]> = this.claims$.pipe(
		map((claims) =>
			Array.isArray(claims?.['roles'])
				? (claims['roles'] as StaffRole[])
				: [],
		),
	);
	public readonly isCheckin$ = this.hasRole('checkin');
	public readonly isElevated$ = this.claims$.pipe(
		map(
			(claims) =>
				claims?.['owner'] === true ||
				(Array.isArray(claims?.['roles']) &&
					(claims['roles'].includes('admin') ||
						claims['roles'].includes('checkin'))),
		),
	);
	public hasRole(role: StaffRole): Observable<boolean> {
		return this.claims$.pipe(
			map(
				(claims) =>
					claims?.['owner'] === true ||
					(Array.isArray(claims?.['roles']) &&
						(claims['roles'].includes('admin') ||
							claims['roles'].includes(role))),
			),
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
