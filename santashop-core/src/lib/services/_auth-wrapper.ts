import { Injectable } from '@angular/core';
import {
	Auth,
	User as _User,
	UserCredential as _UserCredential,
	sendPasswordResetEmail,
	signInWithEmailAndPassword,
	updatePassword,
} from '@angular/fire/auth';
import { authState } from 'rxfire/auth';

export type User = _User;
export type UserCredential = _UserCredential;

@Injectable({
	providedIn: 'root',
})
export class AuthWrapper {
	constructor(private readonly auth: Auth) {}

	public readonly authState = authState(this.auth);

	public readonly currentUser = (): _User | null => this.auth.currentUser;

	public readonly sendPasswordResetEmail = (email: string): Promise<void> =>
		sendPasswordResetEmail(this.auth, email);

	public readonly signInWithEmailAndPassword = (
		email: string,
		password: string
	): Promise<_UserCredential> =>
		signInWithEmailAndPassword(this.auth, email, password);

	public readonly updatePassword = (
		user: User,
		newPassword: string
	): Promise<void> => updatePassword(user, newPassword);

	public readonly signOut = (): Promise<void> => this.auth.signOut();
}
