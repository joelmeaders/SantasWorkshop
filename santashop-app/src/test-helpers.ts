import { Provider } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ModalController, PopoverController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of } from 'rxjs';
import { type Mocked, vi } from 'vitest';
import {
	FIREBASE_ANALYTICS,
	FIREBASE_AUTH,
	FIREBASE_FIRESTORE,
	FIREBASE_FUNCTIONS,
	FIREBASE_STORAGE,
} from '@santashop/core';
import { createMock } from '../../test-helpers/vitest';

export function createTranslateServiceMock(): Mocked<TranslateService> {
	const onLangChange = new BehaviorSubject({ lang: 'en', translations: {} });
	const onTranslationChange = new BehaviorSubject({ lang: 'en', translations: {} });
	const onFallbackLangChange = new BehaviorSubject({ lang: 'en', translations: {} });
	const mock = {
		_currentLang: 'en', _fallbackLang: 'en', _langs: [] as string[], translations: { en: {} },
		onLangChange: onLangChange.asObservable(), onTranslationChange: onTranslationChange.asObservable(),
		onFallbackLangChange: onFallbackLangChange.asObservable(),
		get: vi.fn().mockReturnValue(of('translated')),
		use: vi.fn(), addLangs: vi.fn(), setFallbackLang: vi.fn(),
		getBrowserLang: vi.fn().mockReturnValue('en'), instant: vi.fn().mockReturnValue('translated'),
		stream: vi.fn().mockReturnValue(of('translated')),
		getCurrentLang: vi.fn(), getFallbackLang: vi.fn(), getLangs: vi.fn(),
		getParsedResult: vi.fn().mockReturnValue(of('translated')),
	};
	mock.use.mockImplementation((lang: string) => { mock._currentLang = lang; return of({ lang, translations: {} }); });
	mock.addLangs.mockImplementation((langs: string[]) => { mock._langs = langs; });
	mock.setFallbackLang.mockImplementation((lang: string) => { mock._fallbackLang = lang; });
	mock.getCurrentLang.mockImplementation(() => mock._currentLang);
	mock.getFallbackLang.mockImplementation(() => mock._fallbackLang);
	mock.getLangs.mockImplementation(() => mock._langs);
	return mock as unknown as Mocked<TranslateService>;
}

export function provideTranslateServiceMock(): Provider {
	return { provide: TranslateService, useFactory: createTranslateServiceMock };
}

export function createModalControllerMock(): Mocked<ModalController> {
	return createMock<ModalController>(['create', 'dismiss', 'getTop']);
}

export function createPopoverControllerMock(): Mocked<PopoverController> {
	return createMock<PopoverController>(['create', 'dismiss', 'getTop']);
}

export function createActivatedRouteMock(): Partial<ActivatedRoute> {
	return {
		snapshot: {
			params: {}, queryParams: {}, data: {}, url: [], fragment: null, outlet: 'primary',
			component: null, routeName: null, title: undefined, paramMap: convertToParamMap({}),
			queryParamMap: convertToParamMap({}), root: {} as never, parent: null, firstChild: null,
			children: [], pathFromRoot: [],
		} as never,
		params: of({}), queryParams: of({}), paramMap: of(convertToParamMap({})),
		queryParamMap: of(convertToParamMap({})), data: of({}),
	};
}

export function provideActivatedRouteMock(): Provider {
	return { provide: ActivatedRoute, useFactory: createActivatedRouteMock };
}

export function createAuthMock(): object {
	return {
		...createMock<{
			signInWithEmailAndPassword: () => unknown; createUserWithEmailAndPassword: () => unknown;
			signOut: () => unknown; sendPasswordResetEmail: () => unknown;
			authStateReady: () => Promise<void>;
		}>(['signInWithEmailAndPassword', 'createUserWithEmailAndPassword', 'signOut', 'sendPasswordResetEmail', 'authStateReady']),
		currentUser: null,
		onAuthStateChanged: vi.fn().mockReturnValue(() => undefined),
		authStateReady: vi.fn().mockResolvedValue(undefined),
	};
}

export function createFirestoreMock(): object {
	const docMock = {
		set: vi.fn().mockResolvedValue(undefined), get: vi.fn().mockResolvedValue(undefined),
		update: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined),
	};
	const collectionMock = { doc: vi.fn().mockReturnValue(docMock), add: vi.fn().mockResolvedValue(undefined) };
	return { collection: vi.fn().mockReturnValue(collectionMock), doc: vi.fn().mockReturnValue(docMock) };
}

export function createFunctionsMock(): object {
	return { httpsCallable: vi.fn().mockReturnValue(() => of({})) };
}

export function createStorageMock(): object {
	return { ref: vi.fn().mockReturnValue({ put: vi.fn(), getDownloadURL: vi.fn().mockReturnValue(of('http://example.com/file')) }) };
}

export function createAnalyticsMock(): object {
	return { app: { name: 'mock-app', options: { apiKey: 'mock-api-key', projectId: 'mock-project-id' }, automaticDataCollectionEnabled: false } };
}

export function createAppStateServiceMock(): object {
	return {
		globalAlert$: of({ enabled: false }), message$: of(null), isMaintenanceModeEnabled$: of(false),
		isRegistrationEnabled$: of(true), shopClosedWeather$: of(false), createAccountEnabled$: of(true),
		setModal: vi.fn(), openModal: vi.fn().mockResolvedValue(undefined), closeExistingModals: vi.fn().mockResolvedValue(undefined),
	};
}

export function provideAuthMock(): Provider { return { provide: FIREBASE_AUTH, useFactory: createAuthMock }; }
export function provideFirestoreMock(): Provider { return { provide: FIREBASE_FIRESTORE, useFactory: createFirestoreMock }; }
export function provideFunctionsMock(): Provider { return { provide: FIREBASE_FUNCTIONS, useFactory: createFunctionsMock }; }
export function provideStorageMock(): Provider { return { provide: FIREBASE_STORAGE, useFactory: createStorageMock }; }
export function provideAnalyticsMock(): Provider { return { provide: FIREBASE_ANALYTICS, useFactory: createAnalyticsMock }; }
