import { Provider } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ModalController, PopoverController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { type Mocked, vi } from 'vitest';
import { createMock } from './vitest';

export function createTranslateServiceMock(): Mocked<TranslateService> {
	return {
		...createMock<TranslateService>([
			'get',
			'use',
			'addLangs',
			'setFallbackLang',
			'getBrowserLang',
			'instant',
			'stream',
			'getCurrentLang',
			'getFallbackLang',
			'getLangs',
		]),
		onLangChange: of({ lang: 'en', translations: {} }),
		onTranslationChange: of({ lang: 'en', translations: {} }),
		onFallbackLangChange: of({ lang: 'en', translations: {} }),
	} as Mocked<TranslateService>;
}

export function provideTranslateServiceMock(): Provider {
	return { provide: TranslateService, useFactory: createTranslateServiceMock };
}

export function createFirebaseAuthMock() {
	return {
		...createMock<{
			signInWithEmailAndPassword: () => unknown;
			signOut: () => unknown;
			createUserWithEmailAndPassword: () => unknown;
			authStateReady: () => Promise<void>;
		}>([
			'signInWithEmailAndPassword',
			'signOut',
			'createUserWithEmailAndPassword',
			'authStateReady',
		]),
		currentUser: null,
		authStateReady: vi.fn().mockResolvedValue(undefined),
	};
}

export function createFirebaseFirestoreMock() {
	return createMock<{ collection: () => unknown; doc: () => unknown }>([
		'collection',
		'doc',
	]);
}

export function createFirebaseFunctionsMock() {
	return createMock<{ httpsCallable: () => unknown }>(['httpsCallable']);
}

export function createFirebaseStorageMock() {
	return createMock<{ ref: () => unknown; upload: () => unknown }>(['ref', 'upload']);
}

export function createFirebaseAnalyticsMock() {
	return {
		app: {
			name: 'mock-app',
			options: { apiKey: 'mock-api-key', projectId: 'mock-project-id' },
			automaticDataCollectionEnabled: false,
		},
	};
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
			params: {}, queryParams: {}, data: {}, url: [], fragment: null,
			outlet: 'primary', component: null, routeName: null, title: undefined,
			paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}),
			root: {} as never, parent: null, firstChild: null, children: [], pathFromRoot: [],
		} as never,
		params: of({}), queryParams: of({}), data: of({}),
	};
}

export function provideActivatedRouteMock(): Provider {
	return { provide: ActivatedRoute, useFactory: createActivatedRouteMock };
}
