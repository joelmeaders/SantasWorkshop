import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import { describe, expect, it, vi } from 'vitest';
import type { CustomerAppConfig } from '../../../core/tokens/customer-runtime.token';
import {
	initializeFullFirestore,
	type FullFirestoreDependencies,
} from './initialize-full-firestore';

const config = (production: boolean): CustomerAppConfig => ({
	appCheckEnabled: false,
	appCheckKey: '',
	emulatorPorts: {
		auth: 9099,
		firestore: 8180,
		functions: 5001,
		storage: 9199,
	},
	production,
	programYear: 2026,
	shopDays: [12, 13, 15, 16],
});

describe('initializeFullFirestore', () => {
	it('connects the lazy full client to the configured local emulator', () => {
		const firestore = {} as Firestore;
		const dependencies: FullFirestoreDependencies = {
			connectFirestoreEmulator: vi.fn(),
			getFirestore: vi.fn().mockReturnValue(firestore),
		};
		const app = {} as FirebaseApp;

		expect(initializeFullFirestore(app, config(false), dependencies)).toBe(
			firestore,
		);
		expect(dependencies.getFirestore).toHaveBeenCalledWith(app);
		expect(dependencies.connectFirestoreEmulator).toHaveBeenCalledWith(
			firestore,
			'127.0.0.1',
			8180,
		);
	});

	it('does not connect the production client to an emulator', () => {
		const dependencies: FullFirestoreDependencies = {
			connectFirestoreEmulator: vi.fn(),
			getFirestore: vi.fn().mockReturnValue({}),
		};

		initializeFullFirestore({} as FirebaseApp, config(true), dependencies);

		expect(dependencies.connectFirestoreEmulator).not.toHaveBeenCalled();
	});
});
