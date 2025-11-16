import { Provider } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { Storage } from '@angular/fire/storage';
import { Analytics } from '@angular/fire/analytics';
import { ActivatedRoute } from '@angular/router';
import {
	ModalController,
	PopoverController,
	AlertController,
	LoadingController,
} from '@ionic/angular/standalone';
import { of } from 'rxjs';
import {
	FirestoreWrapper,
	FireRepoLite,
	IFireRepoCollection,
	PROGRAM_YEAR,
} from '@santashop/core';

/**
 * Creates a mock Firebase Auth instance.
 */
export function createAuthMock(): jasmine.SpyObj<Auth> {
	const mock = jasmine.createSpyObj('Auth', [
		'signInWithEmailAndPassword',
		'signOut',
		'createUserWithEmailAndPassword',
		'sendPasswordResetEmail',
		'onAuthStateChanged',
		'authStateReady',
	]) as jasmine.SpyObj<Auth> & { currentUser: null };
	mock.currentUser = null;
	const authStateChangedSpy = jasmine
		.createSpy('onAuthStateChanged')
		.and.returnValue(() => undefined);
	(mock as any).onAuthStateChanged = authStateChangedSpy;
	mock.authStateReady.and.returnValue(Promise.resolve());
	return mock;
}

/**
 * Provider for Firebase Auth mock.
 */
export function provideAuthMock(): Provider {
	return {
		provide: Auth,
		useFactory: createAuthMock,
	};
}

/**
 * Creates a mock FirestoreWrapper instance.
 */
export function createFirestoreWrapperMock(): jasmine.SpyObj<FirestoreWrapper> {
	const docMock = {
		set: jasmine.createSpy('set').and.returnValue(Promise.resolve()),
		get: jasmine
			.createSpy('get')
			.and.returnValue(
				Promise.resolve({ exists: () => false, data: () => ({}) }),
			),
		update: jasmine.createSpy('update').and.returnValue(Promise.resolve()),
		delete: jasmine.createSpy('delete').and.returnValue(Promise.resolve()),
		id: 'mock-doc-id',
		path: 'mock-collection/mock-doc-id',
	};

	const collectionMock = {
		id: 'mock-collection',
		path: 'mock-collection',
	};

	const mock = jasmine.createSpyObj('FirestoreWrapper', [
		'collection',
		'collectionQuery',
		'doc',
		'docData',
		'query',
		'addDoc',
		'setDoc',
		'deleteDoc',
	]);

	mock.collection.and.returnValue(collectionMock);
	mock.collectionQuery.and.returnValue(of([]));
	mock.doc.and.returnValue(docMock);
	mock.docData.and.returnValue(of(undefined));
	mock.query.and.returnValue({});
	mock.addDoc.and.returnValue(Promise.resolve(docMock));
	mock.setDoc.and.returnValue(Promise.resolve());
	mock.deleteDoc.and.returnValue(Promise.resolve());

	return mock;
}

/**
 * Provider for FirestoreWrapper mock.
 */
export function provideFirestoreWrapperMock(): Provider {
	return {
		provide: FirestoreWrapper,
		useFactory: createFirestoreWrapperMock,
	};
}

/**
 * Creates a mock Firebase Firestore instance.
 */
export function createFirestoreMock(): jasmine.SpyObj<Firestore> {
	const docMock = {
		set: jasmine.createSpy('set').and.returnValue(Promise.resolve()),
		get: jasmine
			.createSpy('get')
			.and.returnValue(
				Promise.resolve({ exists: () => false, data: () => ({}) }),
			),
		update: jasmine.createSpy('update').and.returnValue(Promise.resolve()),
		delete: jasmine.createSpy('delete').and.returnValue(Promise.resolve()),
		firestore: null as unknown as Firestore, // Will be set below
		type: 'document',
		path: 'mock-collection/mock-doc',
	};

	const collectionMock = {
		doc: jasmine.createSpy('doc').and.returnValue(docMock),
		add: jasmine
			.createSpy('add')
			.and.returnValue(Promise.resolve({ id: 'mock-id' })),
		get: jasmine
			.createSpy('get')
			.and.returnValue(Promise.resolve({ docs: [] })),
		firestore: null as unknown as Firestore, // Will be set below
		type: 'collection',
		path: 'mock-collection',
	};

	const firestoreMock = {
		collection: jasmine
			.createSpy('collection')
			.and.returnValue(collectionMock),
		doc: jasmine.createSpy('doc').and.returnValue(docMock),
		_databaseId: { database: 'mock-database' },
		type: 'firestore',
		app: {
			name: 'mock-app',
			options: {},
			automaticDataCollectionEnabled: false,
		},
		toJSON: () => ({}),
	} as unknown as jasmine.SpyObj<Firestore>;

	// Set circular references so collection/doc references point back to firestore
	collectionMock.firestore = firestoreMock;
	docMock.firestore = firestoreMock;

	return firestoreMock;
}

/**
 * Provider for Firebase Firestore mock.
 */
export function provideFirestoreMock(): Provider {
	return {
		provide: Firestore,
		useFactory: createFirestoreMock,
	};
}

export function createFireRepoLiteMock(): jasmine.SpyObj<FireRepoLite> {
	const collectionMock = jasmine.createSpyObj<IFireRepoCollection<unknown>>(
		'FireRepoCollection',
		['read', 'readMany', 'add', 'addById', 'update', 'delete'],
	);

	collectionMock.read.and.returnValue(of(undefined));
	collectionMock.readMany.and.returnValue(of([]));
	collectionMock.add.and.returnValue(of({} as any));
	collectionMock.addById.and.returnValue(of({} as any));
	collectionMock.update.and.returnValue(of({} as any));
	collectionMock.delete.and.returnValue(of(void 0));

	const mock = jasmine.createSpyObj<FireRepoLite>('FireRepoLite', [
		'collection',
		'randomId',
	]);

	(mock.collection as jasmine.Spy).and.returnValue(collectionMock);
	mock.randomId.and.returnValue('mock-random-id');

	return mock;
}

export function provideFireRepoLiteMock(): Provider {
	return {
		provide: FireRepoLite,
		useFactory: createFireRepoLiteMock,
	};
}

/**
 * Creates a mock Firebase Functions instance.
 */
export function createFunctionsMock(): jasmine.SpyObj<Functions> {
	return jasmine.createSpyObj('Functions', ['httpsCallable']);
}

/**
 * Provider for Firebase Functions mock.
 */
export function provideFunctionsMock(): Provider {
	return {
		provide: Functions,
		useFactory: createFunctionsMock,
	};
}

/**
 * Creates a mock Firebase Storage instance.
 */
export function createStorageMock(): jasmine.SpyObj<Storage> {
	return jasmine.createSpyObj('Storage', ['ref', 'upload']);
}

/**
 * Provider for Firebase Storage mock.
 */
export function provideStorageMock(): Provider {
	return {
		provide: Storage,
		useFactory: createStorageMock,
	};
}

/**
 * Creates a mock Firebase Analytics instance.
 */
export function createAnalyticsMock(): jasmine.SpyObj<Analytics> {
	return jasmine.createSpyObj('Analytics', [
		'logEvent',
		'setCurrentScreen',
		'setUserId',
	]);
}

/**
 * Provider for Firebase Analytics mock.
 */
export function provideAnalyticsMock(): Provider {
	return {
		provide: Analytics,
		useFactory: createAnalyticsMock,
	};
}

/**
 * Creates a mock ModalController.
 */
export function createModalControllerMock(): jasmine.SpyObj<ModalController> {
	const mock = jasmine.createSpyObj('ModalController', [
		'create',
		'dismiss',
		'getTop',
	]);
	mock.create.and.returnValue(
		Promise.resolve({
			present: jasmine
				.createSpy('present')
				.and.returnValue(Promise.resolve()),
			dismiss: jasmine
				.createSpy('dismiss')
				.and.returnValue(Promise.resolve()),
			onDidDismiss: jasmine
				.createSpy('onDidDismiss')
				.and.returnValue(Promise.resolve({ data: null })),
		} as unknown as HTMLIonModalElement),
	);
	return mock;
}

/**
 * Provider for ModalController mock.
 */
export function provideModalControllerMock(): Provider {
	return {
		provide: ModalController,
		useFactory: createModalControllerMock,
	};
}

/**
 * Creates a mock AlertController.
 */
export function createAlertControllerMock(): jasmine.SpyObj<AlertController> {
	const mock = jasmine.createSpyObj('AlertController', ['create']);
	mock.create.and.returnValue(
		Promise.resolve({
			present: jasmine
				.createSpy('present')
				.and.returnValue(Promise.resolve()),
			dismiss: jasmine
				.createSpy('dismiss')
				.and.returnValue(Promise.resolve()),
		} as unknown as HTMLIonAlertElement),
	);
	return mock;
}

/**
 * Provider for AlertController mock.
 */
export function provideAlertControllerMock(): Provider {
	return {
		provide: AlertController,
		useFactory: createAlertControllerMock,
	};
}

/**
 * Creates a mock LoadingController.
 */
export function createLoadingControllerMock(): jasmine.SpyObj<LoadingController> {
	const mock = jasmine.createSpyObj('LoadingController', ['create']);
	mock.create.and.returnValue(
		Promise.resolve({
			present: jasmine
				.createSpy('present')
				.and.returnValue(Promise.resolve()),
			dismiss: jasmine
				.createSpy('dismiss')
				.and.returnValue(Promise.resolve()),
		} as unknown as HTMLIonLoadingElement),
	);
	return mock;
}

/**
 * Provider for LoadingController mock.
 */
export function provideLoadingControllerMock(): Provider {
	return {
		provide: LoadingController,
		useFactory: createLoadingControllerMock,
	};
}

/**
 * Creates a mock PopoverController.
 */
export function createPopoverControllerMock(): jasmine.SpyObj<PopoverController> {
	return jasmine.createSpyObj('PopoverController', [
		'create',
		'dismiss',
		'getTop',
	]);
}

/**
 * Provider for PopoverController mock.
 */
export function providePopoverControllerMock(): Provider {
	return {
		provide: PopoverController,
		useFactory: createPopoverControllerMock,
	};
}

/**
 * Creates a mock ActivatedRoute.
 */
export function createActivatedRouteMock(): Partial<ActivatedRoute> {
	return {
		snapshot: {
			params: {},
			queryParams: {},
			data: {},
			url: [],
			fragment: null,
			outlet: 'primary',
			component: null,
			routeName: null,
			title: undefined,
			routeConfig: null,
			root: {} as any,
			parent: null,
			firstChild: null,
			children: [],
			pathFromRoot: [] as any,
			paramMap: {
				get: () => null,
				has: () => false,
				getAll: () => [],
				keys: [],
			} as any,
			queryParamMap: {
				get: () => null,
				has: () => false,
				getAll: () => [],
				keys: [],
			} as any,
		} as any,
		params: of({}),
		queryParams: of({}),
		data: of({}),
	};
}

/**
 * Provider for ActivatedRoute mock.
 */
export function provideActivatedRouteMock(): Provider {
	return {
		provide: ActivatedRoute,
		useFactory: createActivatedRouteMock,
	};
}

/**
 * Creates a mock ScannerService.
 */
export function createScannerServiceMock(): jasmine.SpyObj<{
	scan: () => void;
	stopScan: () => void;
	onCamerasFound: () => void;
	onDeviceSelectChange: () => void;
	onDeviceChange: () => void;
	onHasPermission: () => void;
	onScanError: () => void;
}> & {
	formatsEnabled: number[];
	$deviceId: typeof of;
	$availableDevices: typeof of;
	$deviceToUse: typeof of;
	$hasPermissions: typeof of;
} {
	const mock = jasmine.createSpyObj('ScannerService', [
		'scan',
		'stopScan',
		'onCamerasFound',
		'onDeviceSelectChange',
		'onDeviceChange',
		'onHasPermission',
		'onScanError',
	]);
	mock.onDeviceChange = jasmine.createSpy('onDeviceChange').and.returnValue({
		subscribe: (): { unsubscribe: () => void } => ({
			unsubscribe: (): void => {
				/* noop */
			},
		}),
	});
	mock.formatsEnabled = []; // ZXing expects an array of formats
	mock.$deviceId = of('');
	mock.$availableDevices = of([]);
	mock.$deviceToUse = of(undefined);
	mock.$hasPermissions = of(false);
	return mock;
}

export function provideProgramYearMock(programYear = 2025): Provider {
	return {
		provide: PROGRAM_YEAR,
		useValue: programYear,
	};
}

export const testHelpers: Provider[] = [
	provideAuthMock(),
	provideFirestoreWrapperMock(),
	provideFirestoreMock(),
	provideFireRepoLiteMock(),
	provideFunctionsMock(),
	provideStorageMock(),
	provideAnalyticsMock(),
	provideModalControllerMock(),
	provideAlertControllerMock(),
	provideLoadingControllerMock(),
	providePopoverControllerMock(),
	provideActivatedRouteMock(),
	provideProgramYearMock(),
];
