import { InjectionToken } from '@angular/core';
import { doc, getDoc, type Firestore } from 'firebase/firestore/lite';

export interface FirestoreLiteDocumentSnapshot {
	exists(): boolean;
	data(): unknown;
}

export interface FirestoreLiteDocumentReader {
	getDocument(
		firestore: Firestore,
		collectionPath: string,
		documentId: string,
	): Promise<FirestoreLiteDocumentSnapshot>;
}

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

export const FIREBASE_FIRESTORE_LITE_DOCUMENT_READER =
	new InjectionToken<FirestoreLiteDocumentReader>(
		'firebase-firestore-lite-document-reader',
		{
			providedIn: 'root',
			factory: (): FirestoreLiteDocumentReader => ({
				getDocument: (
					firestore: Firestore,
					collectionPath: string,
					documentId: string,
				): Promise<FirestoreLiteDocumentSnapshot> =>
					getDoc(doc(firestore, collectionPath, documentId)),
			}),
		},
	);
