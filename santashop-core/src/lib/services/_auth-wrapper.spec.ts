import { NgZone } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
	EmailAuthProvider,
	onAuthStateChanged,
	reauthenticateWithCredential,
	sendPasswordResetEmail,
	signInWithEmailAndPassword,
	updatePassword,
	type Auth,
	type IdTokenResult,
	type User,
	type UserCredential,
} from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIREBASE_AUTH } from '../tokens';
import { AuthWrapper } from './_auth-wrapper';

vi.mock('firebase/auth', () => ({
	EmailAuthProvider: { credential: vi.fn() },
	onAuthStateChanged: vi.fn(),
	reauthenticateWithCredential: vi.fn(),
	sendPasswordResetEmail: vi.fn(),
	signInWithEmailAndPassword: vi.fn(),
	updatePassword: vi.fn(),
}));

describe('AuthWrapper', () => {
	let service: AuthWrapper;
	const token = { claims: { admin: true } } as unknown as IdTokenResult;
	const user = {
		email: 'staff@example.test',
		getIdTokenResult: vi.fn().mockResolvedValue(token),
	} as unknown as User;
	const auth = {
		authStateReady: vi.fn().mockResolvedValue(undefined),
		currentUser: user,
		signOut: vi.fn().mockResolvedValue(undefined),
	} as unknown as Auth;

	beforeEach(() => {
		vi.mocked(onAuthStateChanged).mockReset();
		vi.mocked(sendPasswordResetEmail).mockReset();
		vi.mocked(signInWithEmailAndPassword).mockReset();
		vi.mocked(updatePassword).mockReset();
		vi.mocked(reauthenticateWithCredential).mockReset();
		vi.mocked(EmailAuthProvider.credential).mockReset();
		TestBed.configureTestingModule({
			providers: [
				{ provide: FIREBASE_AUTH, useValue: auth },
				{
					provide: NgZone,
					useValue: { run: <T>(action: () => T): T => action() },
				},
			],
		});
		service = TestBed.inject(AuthWrapper);
	});

	it('emits auth state changes inside the Angular zone', async () => {
		vi.mocked(onAuthStateChanged).mockImplementation((_, next) => {
			(next as (value: User | null) => void)(user);
			return vi.fn();
		});

		await expect(firstValueFrom(service.authState())).resolves.toBe(user);
		expect(auth.authStateReady).toHaveBeenCalled();
	});

	it('forwards auth state errors', async () => {
		const expected = new Error('auth failed');
		vi.mocked(onAuthStateChanged).mockImplementation((_, __, error) => {
			error?.(expected);
			return vi.fn();
		});

		await expect(firstValueFrom(service.authState())).rejects.toBe(expected);
	});

	it('returns the current user and token, including the signed-out case', async () => {
		expect(service.currentUser()).toBe(user);
		await expect(service.getCurrentUserToken()).resolves.toBe(token);

		Object.defineProperty(auth, 'currentUser', { configurable: true, value: null });
		await expect(service.getCurrentUserToken()).resolves.toBeNull();
		Object.defineProperty(auth, 'currentUser', { configurable: true, value: user });
	});

	it('forwards password reset, sign-in, password update, and sign-out', async () => {
		const credential = {} as UserCredential;
		vi.mocked(sendPasswordResetEmail).mockResolvedValue(undefined);
		vi.mocked(signInWithEmailAndPassword).mockResolvedValue(credential);
		vi.mocked(updatePassword).mockResolvedValue(undefined);

		await service.sendPasswordResetEmail('staff@example.test');
		await expect(
			service.signInWithEmailAndPassword('staff@example.test', 'secret'),
		).resolves.toBe(credential);
		await service.updatePassword(user, 'new-secret');
		await service.signOut();

		expect(sendPasswordResetEmail).toHaveBeenCalledWith(
			auth,
			'staff@example.test',
		);
		expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
			auth,
			'staff@example.test',
			'secret',
		);
		expect(updatePassword).toHaveBeenCalledWith(user, 'new-secret');
		expect(auth.signOut).toHaveBeenCalled();
	});

	it('reauthenticates with an email credential', async () => {
		const credential = {} as ReturnType<typeof EmailAuthProvider.credential>;
		const result = {} as UserCredential;
		vi.mocked(EmailAuthProvider.credential).mockReturnValue(credential);
		vi.mocked(reauthenticateWithCredential).mockResolvedValue(result);

		await expect(service.reauthenticateWithPassword(user, 'secret')).resolves.toBe(
			result,
		);
		expect(EmailAuthProvider.credential).toHaveBeenCalledWith(
			'staff@example.test',
			'secret',
		);
		expect(reauthenticateWithCredential).toHaveBeenCalledWith(user, credential);
	});

	it('rejects reauthentication when the account has no email', async () => {
		const noEmailUser = { email: null } as User;

		await expect(
			service.reauthenticateWithPassword(noEmailUser, 'secret'),
		).rejects.toThrow('does not have an email address');
		expect(reauthenticateWithCredential).not.toHaveBeenCalled();
	});
});
