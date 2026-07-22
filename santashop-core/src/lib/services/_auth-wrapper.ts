import { Injectable, NgZone, inject } from '@angular/core';
import {
	onAuthStateChanged,
	sendPasswordResetEmail,
	signInWithEmailAndPassword,
	updatePassword,
	type Auth,
	type IdTokenResult,
	type User,
	type UserCredential,
} from 'firebase/auth';
import { from, Observable, switchMap } from 'rxjs';
import { FIREBASE_AUTH } from '../tokens';

const emitInZone = <T>(
	zone: NgZone,
	emit: (value: T) => void,
	value: T,
): void => {
	zone.run(() => emit(value));
};

function authState(auth: Auth, zone: NgZone): Observable<User | null> {
	return from(auth.authStateReady()).pipe(
		switchMap(
			() =>
				new Observable<User | null>((subscriber) => {
						const emitUser = subscriber.next.bind(subscriber);
						const emitError = subscriber.error.bind(subscriber);

					const nextUser = (user: User | null): void => {
							emitInZone(zone, emitUser, user);
					};

					const nextError = (error: Error): void => {
							emitInZone(zone, emitError, error);
					};

					const unsubscribe = onAuthStateChanged(
						auth,
						nextUser,
						nextError,
					);
					return { unsubscribe };
				}),
		),
	);
}

@Injectable({
	providedIn: 'root',
})
export class AuthWrapper {
	private readonly auth = inject(FIREBASE_AUTH);
	private readonly zone = inject(NgZone);

	public readonly authState = (): Observable<User | null> =>
		authState(this.auth, this.zone);

	public readonly currentUser = (): User | null => this.auth.currentUser;

	public readonly getCurrentUserToken = (): Promise<IdTokenResult | null> =>
		this.currentUser()?.getIdTokenResult() ?? Promise.resolve(null);

	public readonly sendPasswordResetEmail = (email: string): Promise<void> =>
		sendPasswordResetEmail(this.auth, email);

	public readonly signInWithEmailAndPassword = (
		email: string,
		password: string,
	): Promise<UserCredential> =>
		signInWithEmailAndPassword(this.auth, email, password);

	public readonly updatePassword = (
		user: User,
		newPassword: string,
	): Promise<void> => updatePassword(user, newPassword);

	public readonly signOut = (): Promise<void> => this.auth.signOut();
}
