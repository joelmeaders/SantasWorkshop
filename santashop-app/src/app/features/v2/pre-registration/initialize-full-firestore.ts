import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import type { CustomerAppConfig } from '../../../core/tokens/customer-runtime.token';

export interface FullFirestoreDependencies {
	readonly connectFirestoreEmulator: (
		firestore: Firestore,
		host: string,
		port: number,
	) => void;
	readonly getFirestore: (app: FirebaseApp) => Firestore;
}

export function initializeFullFirestore(
	app: FirebaseApp,
	config: CustomerAppConfig,
	dependencies: FullFirestoreDependencies,
): Firestore {
	const firestore = dependencies.getFirestore(app);

	if (!config.production) {
		dependencies.connectFirestoreEmulator(
			firestore,
			'127.0.0.1',
			config.emulatorPorts.firestore,
		);
	}

	return firestore;
}
