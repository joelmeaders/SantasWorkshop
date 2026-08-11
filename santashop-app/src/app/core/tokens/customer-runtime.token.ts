import { InjectionToken } from '@angular/core';
import type { Firestore } from 'firebase/firestore/lite';

export interface CustomerAppConfig {
	production: boolean;
	appCheckEnabled: boolean;
	appCheckKey: string;
	programYear: number;
	shopDays: number[];
	emulatorPorts: {
		auth: number;
		functions: number;
		firestore: number;
		storage: number;
	};
}

export const CUSTOMER_APP_CONFIG = new InjectionToken<CustomerAppConfig>(
	'customer-app-config',
);

export const FIREBASE_FIRESTORE_LITE = new InjectionToken<Firestore>(
	'firebase-firestore-lite',
);
