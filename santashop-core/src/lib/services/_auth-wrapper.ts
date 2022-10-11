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


export class AuthWrapper {
	constructor(private readonly auth: Auth) {}

	public readonly authState = () => authState(this.auth);

	public readonly currentUser = () => this.auth.currentUser;

	public readonly sendPasswordResetEmail = (email: string) =>
		sendPasswordResetEmail(this.auth, email);

	public readonly signInWithEmailAndPassword = (
		email: string,
		password: string
	) => signInWithEmailAndPassword(this.auth, email, password);

	public readonly updatePassword = (user: User, newPassword: string) =>
		updatePassword(user, newPassword);

	public readonly signOut = () => this.auth.signOut();
}
