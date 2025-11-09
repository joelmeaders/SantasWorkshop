import { Injectable, inject } from '@angular/core';
import {
	Auth,
	authState,
	User,
	sendPasswordResetEmail,
	signInWithEmailAndPassword,
	updatePassword,
	IdTokenResult,
	UserCredential,
} from '@angular/fire/auth';
import { Observable } from 'rxjs';

@Injectable({
	providedIn: 'root',
})
export class AuthWrapper {
	private readonly auth = inject(Auth);

	public readonly authState = (): Observable<User | null> =>
		authState(this.auth);

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
