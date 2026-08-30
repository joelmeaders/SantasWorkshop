import { Provider } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, ModalController, PopoverController } from '@ionic/angular/standalone';
import { of } from 'rxjs';
import { vi } from 'vitest';
import {
	FIREBASE_ANALYTICS, FIREBASE_AUTH, FIREBASE_FIRESTORE, FIREBASE_FUNCTIONS, FIREBASE_STORAGE,
	FirestoreWrapper, FireRepoLite, PROGRAM_YEAR, PUBLIC_PARAMETERS_SOURCE,
} from '@santashop/core';

import type { Analytics } from 'firebase/analytics';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { Functions } from 'firebase/functions';
import type { FirebaseStorage } from 'firebase/storage';

export function requireDefined<T>(value: T | null | undefined): T {
	if (value === null || value === undefined) {
		throw new Error('Expected a defined value in this test.');
	}
	return value;
}

export function createAuthMock(): Auth & { currentUser: null } {
	return {
		currentUser: null,
		signInWithEmailAndPassword: vi.fn(), signOut: vi.fn(), createUserWithEmailAndPassword: vi.fn(),
		sendPasswordResetEmail: vi.fn(), onAuthStateChanged: vi.fn().mockReturnValue(() => undefined),
		authStateReady: vi.fn().mockResolvedValue(undefined),
	} as unknown as Auth & { currentUser: null };
}

export function provideAuthMock(): Provider { return { provide: FIREBASE_AUTH, useFactory: createAuthMock }; }

export function createFirestoreWrapperMock(): FirestoreWrapper {
	const docMock = {
		set: vi.fn().mockResolvedValue(undefined),
		get: vi.fn().mockResolvedValue({ exists: () => false, data: () => ({}) }),
		update: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined),
		id: 'mock-doc-id', path: 'mock-collection/mock-doc-id',
	};
	const collectionMock = { id: 'mock-collection', path: 'mock-collection' };
	return {
		collection: vi.fn().mockReturnValue(collectionMock), collectionQuery: vi.fn().mockReturnValue(of([])),
		doc: vi.fn().mockReturnValue(docMock), docData: vi.fn().mockReturnValue(of(undefined)),
		query: vi.fn().mockReturnValue({}), addDoc: vi.fn().mockResolvedValue(docMock),
		setDoc: vi.fn().mockResolvedValue(undefined), deleteDoc: vi.fn().mockResolvedValue(undefined),
	} as unknown as FirestoreWrapper;
}

export function provideFirestoreWrapperMock(): Provider { return { provide: FirestoreWrapper, useFactory: createFirestoreWrapperMock }; }

export function createFirestoreMock(): Firestore {
	const docMock = {
		set: vi.fn().mockResolvedValue(undefined),
		get: vi.fn().mockResolvedValue({ exists: () => false, data: () => ({}) }),
		update: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined),
		type: 'document', path: 'mock-collection/mock-doc',
	};
	const collectionMock = {
		doc: vi.fn().mockReturnValue(docMock), add: vi.fn().mockResolvedValue({ id: 'mock-id' }),
		get: vi.fn().mockResolvedValue({ docs: [] }), type: 'collection', path: 'mock-collection',
	};
	const firestoreMock = {
		collection: vi.fn().mockReturnValue(collectionMock), doc: vi.fn().mockReturnValue(docMock),
		_databaseId: { database: 'mock-database' }, type: 'firestore',
		app: { name: 'mock-app', options: {}, automaticDataCollectionEnabled: false }, toJSON: vi.fn().mockReturnValue({}),
	} as unknown as Firestore;
	Object.assign(docMock, { firestore: firestoreMock });
	Object.assign(collectionMock, { firestore: firestoreMock });
	return firestoreMock;
}

export function provideFirestoreMock(): Provider { return { provide: FIREBASE_FIRESTORE, useFactory: createFirestoreMock }; }

export function createFireRepoLiteMock(): FireRepoLite {
	const collectionMock = {
		read: vi.fn().mockReturnValue(of(undefined)), readMany: vi.fn().mockReturnValue(of([])),
		add: vi.fn().mockReturnValue(of({})), addById: vi.fn().mockReturnValue(of({})),
		update: vi.fn().mockReturnValue(of({})), delete: vi.fn().mockReturnValue(of(undefined)),
	};
	return { collection: vi.fn().mockReturnValue(collectionMock), randomId: vi.fn().mockReturnValue('mock-random-id') } as unknown as FireRepoLite;
}

export function provideFireRepoLiteMock(): Provider { return { provide: FireRepoLite, useFactory: createFireRepoLiteMock }; }

export function createFunctionsMock(): Functions { return { httpsCallable: vi.fn() } as unknown as Functions; }
export function provideFunctionsMock(): Provider { return { provide: FIREBASE_FUNCTIONS, useFactory: createFunctionsMock }; }
export function createStorageMock(): FirebaseStorage { return { app: vi.fn(), maxUploadRetryTime: 0 } as unknown as FirebaseStorage; }
export function provideStorageMock(): Provider { return { provide: FIREBASE_STORAGE, useFactory: createStorageMock }; }
export function createAnalyticsMock(): Analytics { return { logEvent: vi.fn(), setCurrentScreen: vi.fn(), setUserId: vi.fn() } as unknown as Analytics; }
export function provideAnalyticsMock(): Provider { return { provide: FIREBASE_ANALYTICS, useFactory: createAnalyticsMock }; }

export function createModalControllerMock(): ModalController {
	return {
		create: vi.fn().mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined), dismiss: vi.fn().mockResolvedValue(undefined), onDidDismiss: vi.fn().mockResolvedValue({ data: null }) }),
		dismiss: vi.fn(), getTop: vi.fn(),
	} as unknown as ModalController;
}
export function provideModalControllerMock(): Provider { return { provide: ModalController, useFactory: createModalControllerMock }; }

export function createAlertControllerMock(): AlertController {
	return { create: vi.fn().mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined), dismiss: vi.fn().mockResolvedValue(undefined), onDidDismiss: vi.fn().mockResolvedValue({ role: 'cancel', data: null }) }) } as unknown as AlertController;
}
export function provideAlertControllerMock(): Provider { return { provide: AlertController, useFactory: createAlertControllerMock }; }

export function createLoadingControllerMock(): LoadingController {
	return {
		create: vi.fn().mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined), dismiss: vi.fn().mockResolvedValue(undefined) }),
		dismiss: vi.fn().mockResolvedValue(true), getTop: vi.fn().mockResolvedValue({}),
	} as unknown as LoadingController;
}
export function provideLoadingControllerMock(): Provider { return { provide: LoadingController, useFactory: createLoadingControllerMock }; }
export function createPopoverControllerMock(): PopoverController { return { create: vi.fn(), dismiss: vi.fn(), getTop: vi.fn() } as unknown as PopoverController; }
export function providePopoverControllerMock(): Provider { return { provide: PopoverController, useFactory: createPopoverControllerMock }; }

export function createActivatedRouteMock(): Partial<ActivatedRoute> {
	return {
		snapshot: {
			params: {}, queryParams: {}, data: {}, url: [], fragment: null, outlet: 'primary', component: null,
			routeName: null, title: undefined, routeConfig: null, root: {} as never, parent: null, firstChild: null,
			children: [], pathFromRoot: [], paramMap: { get: () => null, has: () => false, getAll: () => [], keys: [] },
			queryParamMap: { get: () => null, has: () => false, getAll: () => [], keys: [] },
		} as never,
		params: of({}), queryParams: of({}), data: of({}),
	};
}
export function provideActivatedRouteMock(): Provider { return { provide: ActivatedRoute, useFactory: createActivatedRouteMock }; }

export function createScannerServiceMock(): object {
	return {
		scan: vi.fn(), stopScan: vi.fn(), onCamerasFound: vi.fn(), onDeviceSelectChange: vi.fn(),
		onDeviceChange: vi.fn().mockReturnValue({ subscribe: (): { unsubscribe: () => undefined } => ({ unsubscribe: (): undefined => undefined }) }),
		onHasPermission: vi.fn(), onScanError: vi.fn(), formatsEnabled: [],
		$deviceId: of(''), $availableDevices: of([]), $deviceToUse: of(undefined), $hasPermissions: of(false),
	};
}

export function provideProgramYearMock(programYear = 2025): Provider { return { provide: PROGRAM_YEAR, useValue: programYear }; }
export function providePublicParametersSourceMock(): Provider {
	return {
		provide: PUBLIC_PARAMETERS_SOURCE,
		useValue: { publicParameters$: of(undefined) },
	};
}

export const testHelpers: Provider[] = [
	provideAuthMock(), provideFirestoreWrapperMock(), provideFirestoreMock(), provideFireRepoLiteMock(),
	provideFunctionsMock(), provideStorageMock(), provideAnalyticsMock(), provideModalControllerMock(),
	provideAlertControllerMock(), provideLoadingControllerMock(), providePopoverControllerMock(),
	provideActivatedRouteMock(), provideProgramYearMock(), providePublicParametersSourceMock(),
];
