import type { FirebaseApp } from 'firebase/app';
import type { Firestore, FirestoreSettings } from 'firebase/firestore';
import type { AdminBootstrapConfig } from '../bootstrap-admin';

export interface AdminFirestoreDependencies {
	readonly connectFirestoreEmulator: (
		firestore: Firestore,
		host: string,
		port: number,
	) => void;
	readonly getFirestore: (app: FirebaseApp) => Firestore;
	readonly initializeFirestore: (
		app: FirebaseApp,
		settings: FirestoreSettings,
	) => Firestore;
}

export function initializeAdminFirestore(
	app: FirebaseApp,
	config: AdminBootstrapConfig,
	dependencies: AdminFirestoreDependencies,
): Firestore {
	const firestore = config.production
		? dependencies.getFirestore(app)
		: dependencies.initializeFirestore(app, {
				experimentalForceLongPolling: true,
			});

	if (!config.production) {
		dependencies.connectFirestoreEmulator(
			firestore,
			'127.0.0.1',
			config.emulatorPorts.firestore,
		);
	}

	return firestore;
}
