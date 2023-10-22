import { Injectable } from '@angular/core';
import {
	Auth,
	authState,
	User as _User,
	UserCredential as _UserCredential,
	sendPasswordResetEmail,
	signInWithEmailAndPassword,
	updatePassword,
	IdTokenResult as _IdTokenResult,
} from '@angular/fire/auth';
import {
	redirectUnauthorizedTo as _redirectUnauthorizedTo,
	redirectLoggedInTo as _redirectLoggedInTo,
	hasCustomClaim as _hasCustomClaim,
} from '@angular/fire/auth-guard';
import { Observable } from 'rxjs';

export type User = _User;
export type UserCredential = _UserCredential;
export type IdTokenResult = _IdTokenResult;
export const redirectUnauthorizedTo = _redirectUnauthorizedTo;
export const redirectLoggedInTo = _redirectLoggedInTo;
export const hasCustomClaim = _hasCustomClaim;

@Injectable({
	providedIn: 'root',
})
export class AuthWrapper {
	constructor(private readonly auth: Auth) {}

	public readonly authState = (): Observable<_User | null> =>
		authState(this.auth);

	public readonly currentUser = (): _User | null => this.auth.currentUser;

	public readonly getCurrentUserToken = (): Promise<IdTokenResult | null> =>
		this.currentUser()?.getIdTokenResult() ?? Promise.resolve(null);

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
