import { Provider } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ModalController, PopoverController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of } from 'rxjs';
import {
	FIREBASE_ANALYTICS,
	FIREBASE_AUTH,
	FIREBASE_FIRESTORE,
	FIREBASE_FUNCTIONS,
	FIREBASE_STORAGE,
} from '@santashop/core';

/**
 * Creates a mock TranslateService with common methods and observables.
 */
export function createTranslateServiceMock(): any {
	const onLangChange = new BehaviorSubject({ lang: 'en', translations: {} });
	const onTranslationChange = new BehaviorSubject({
		lang: 'en',
		translations: {},
	});
	const onFallbackLangChange = new BehaviorSubject({
		lang: 'en',
		translations: {},
	});

	const mock = {
		_currentLang: 'en',
		_fallbackLang: 'en',
		_langs: [] as string[],
		translations: { en: {} },
		onLangChange: onLangChange.asObservable(),
		onTranslationChange: onTranslationChange.asObservable(),
		onFallbackLangChange: onFallbackLangChange.asObservable(),
		get: jasmine.createSpy('get').and.returnValue(of('translated')),
		use: jasmine.createSpy('use').and.callFake((lang: string) => {
			mock._currentLang = lang;
			return of({ lang, translations: {} });
		}),
		addLangs: jasmine
			.createSpy('addLangs')
			.and.callFake((langs: string[]) => {
				mock._langs = langs;
			}),
		setFallbackLang: jasmine
			.createSpy('setFallbackLang')
			.and.callFake((lang: string) => {
				mock._fallbackLang = lang;
			}),
		getBrowserLang: jasmine
			.createSpy('getBrowserLang')
			.and.returnValue('en'),
		instant: jasmine.createSpy('instant').and.returnValue('translated'),
		stream: jasmine.createSpy('stream').and.returnValue(of('translated')),
		getCurrentLang: jasmine
			.createSpy('getCurrentLang')
			.and.callFake(() => mock._currentLang),
		getFallbackLang: jasmine
			.createSpy('getFallbackLang')
			.and.callFake(() => mock._fallbackLang),
		getLangs: jasmine.createSpy('getLangs').and.callFake(() => mock._langs),
		getParsedResult: jasmine
			.createSpy('getParsedResult')
			.and.returnValue(of('translated')),
	};

	return mock;
}

/**
 * Provider for TranslateService with common mock implementation.
 */
export function provideTranslateServiceMock(): Provider {
	return {
		provide: TranslateService,
		useFactory: createTranslateServiceMock,
	};
}

/**
 * Creates a mock ModalController.
 */
export function createModalControllerMock(): jasmine.SpyObj<ModalController> {
	return jasmine.createSpyObj('ModalController', [
		'create',
		'dismiss',
		'getTop',
	]);
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
			paramMap: jasmine.createSpyObj('ParamMap', [
				'get',
				'has',
				'getAll',
				'keys',
			]),
			queryParamMap: jasmine.createSpyObj('ParamMap', [
				'get',
				'has',
				'getAll',
				'keys',
			]),
			root: {} as any,
			parent: null,
			firstChild: null,
			children: [],
			pathFromRoot: [],
		} as any,
		params: of({}),
		queryParams: of({}),
		paramMap: of(convertToParamMap({})),
		queryParamMap: of(convertToParamMap({})),
		data: of({}),
	};
}

/**
 * Provider for ActivatedRoute with common mock implementation.
 */
export function provideActivatedRouteMock(): Provider {
	return {
		provide: ActivatedRoute,
		useFactory: createActivatedRouteMock,
	};
}

/**
 * Creates a mock Firebase Auth with onAuthStateChanged support.
 */
export function createAuthMock(): any {
	const mock = jasmine.createSpyObj('Auth', [
		'signInWithEmailAndPassword',
		'createUserWithEmailAndPassword',
		'signOut',
		'sendPasswordResetEmail',
		'authStateReady',
	]);
	// Add onAuthStateChanged as a property that returns a function
	Object.defineProperty(mock, 'onAuthStateChanged', {
		value: jasmine
			.createSpy('onAuthStateChanged')
			.and.returnValue((): void => {
				return undefined;
			}),
		writable: true,
		configurable: true,
	});
	mock.currentUser = null;
	mock.authStateReady.and.returnValue(Promise.resolve());
	return mock;
}

/**
 * Creates a mock Firestore with collection/doc support.
 */
export function createFirestoreMock(): any {
	const docMock = {
		set: jasmine.createSpy('set').and.returnValue(Promise.resolve()),
		get: jasmine.createSpy('get').and.returnValue(Promise.resolve()),
		update: jasmine.createSpy('update').and.returnValue(Promise.resolve()),
		delete: jasmine.createSpy('delete').and.returnValue(Promise.resolve()),
	};

	const collectionMock = {
		doc: jasmine.createSpy('doc').and.returnValue(docMock),
		add: jasmine.createSpy('add').and.returnValue(Promise.resolve()),
	};

	return {
		collection: jasmine
			.createSpy('collection')
			.and.returnValue(collectionMock),
		doc: jasmine.createSpy('doc').and.returnValue(docMock),
	};
}

/**
 * Creates a mock Firebase Functions.
 */
export function createFunctionsMock(): any {
	return {
		httpsCallable: jasmine
			.createSpy('httpsCallable')
			.and.returnValue(() => of({})),
	};
}

/**
 * Creates a mock Firebase Storage.
 */
export function createStorageMock(): any {
	return {
		ref: jasmine.createSpy('ref').and.returnValue({
			put: jasmine.createSpy('put'),
			getDownloadURL: jasmine
				.createSpy('getDownloadURL')
				.and.returnValue(of('http://example.com/file')),
		}),
	};
}

/**
 * Creates a mock Firebase Analytics.
 */
export function createAnalyticsMock(): any {
	return {
		app: {
			name: 'mock-app',
			options: {
				apiKey: 'mock-api-key',
				projectId: 'mock-project-id',
			},
			automaticDataCollectionEnabled: false,
		},
	};
}

/**
 * Creates a mock AppStateService.
 */
export function createAppStateServiceMock(): any {
	return {
		globalAlert$: of({ enabled: false }),
		message$: of(null),
		isMaintenanceModeEnabled$: of(false),
		isRegistrationEnabled$: of(true),
		shopClosedWeather$: of(false),
		createAccountEnabled$: of(true),
		setModal: jasmine.createSpy('setModal'),
		openModal: jasmine
			.createSpy('openModal')
			.and.returnValue(Promise.resolve()),
		closeExistingModals: jasmine
			.createSpy('closeExistingModals')
			.and.returnValue(Promise.resolve()),
	};
}

export function provideAuthMock(): Provider {
	return {
		provide: FIREBASE_AUTH,
		useFactory: createAuthMock,
	};
}

export function provideFirestoreMock(): Provider {
	return {
		provide: FIREBASE_FIRESTORE,
		useFactory: createFirestoreMock,
	};
}

export function provideFunctionsMock(): Provider {
	return {
		provide: FIREBASE_FUNCTIONS,
		useFactory: createFunctionsMock,
	};
}

export function provideStorageMock(): Provider {
	return {
		provide: FIREBASE_STORAGE,
		useFactory: createStorageMock,
	};
}

export function provideAnalyticsMock(): Provider {
	return {
		provide: FIREBASE_ANALYTICS,
		useFactory: createAnalyticsMock,
	};
}
