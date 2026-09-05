import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import { describe, expect, it, vi } from 'vitest';
import type { AdminBootstrapConfig } from '../bootstrap-admin';
import {
	initializeAdminFirestore,
	type AdminFirestoreDependencies,
} from './initialize-admin-firestore';

const config = (production: boolean): AdminBootstrapConfig => ({
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

const createDependencies = (
	firestore: Firestore,
): AdminFirestoreDependencies => ({
	connectFirestoreEmulator: vi.fn(),
	getFirestore: vi.fn().mockReturnValue(firestore),
	initializeFirestore: vi.fn().mockReturnValue(firestore),
});

describe('initializeAdminFirestore', () => {
	it('initializes the deferred local client with long polling and the configured emulator', () => {
		const firestore = {} as Firestore;
		const dependencies = createDependencies(firestore);
		const app = {} as FirebaseApp;

		expect(initializeAdminFirestore(app, config(false), dependencies)).toBe(
			firestore,
		);
		expect(dependencies.initializeFirestore).toHaveBeenCalledWith(app, {
			experimentalForceLongPolling: true,
		});
		expect(dependencies.getFirestore).not.toHaveBeenCalled();
		expect(dependencies.connectFirestoreEmulator).toHaveBeenCalledWith(
			firestore,
			'127.0.0.1',
			8180,
		);
	});

	it('gets the production client without emulator settings', () => {
		const firestore = {} as Firestore;
		const dependencies = createDependencies(firestore);
		const app = {} as FirebaseApp;

		expect(initializeAdminFirestore(app, config(true), dependencies)).toBe(
			firestore,
		);
		expect(dependencies.getFirestore).toHaveBeenCalledWith(app);
		expect(dependencies.initializeFirestore).not.toHaveBeenCalled();
		expect(dependencies.connectFirestoreEmulator).not.toHaveBeenCalled();
	});
});
