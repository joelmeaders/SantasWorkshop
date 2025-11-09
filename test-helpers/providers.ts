import { Provider } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ModalController, PopoverController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

/**
 * Creates a mock TranslateService with common methods and observables.
 */
export function createTranslateServiceMock(): jasmine.SpyObj<TranslateService> {
	return jasmine.createSpyObj<TranslateService>(
		'TranslateService',
		[
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
		],
		{
			onLangChange: of({ lang: 'en', translations: {} }),
			onTranslationChange: of({ lang: 'en', translations: {} }),
			onFallbackLangChange: of({ lang: 'en', translations: {} }),
		},
	);
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
 * Creates a mock Firebase Auth instance.
 */
export function createFirebaseAuthMock() {
	return jasmine.createSpyObj('Auth', [
		'signInWithEmailAndPassword',
		'signOut',
		'createUserWithEmailAndPassword',
	]);
}

/**
 * Creates a mock Firebase Firestore instance.
 */
export function createFirebaseFirestoreMock() {
	return jasmine.createSpyObj('Firestore', ['collection', 'doc']);
}

/**
 * Creates a mock Firebase Functions instance.
 */
export function createFirebaseFunctionsMock() {
	return jasmine.createSpyObj('Functions', ['httpsCallable']);
}

/**
 * Creates a mock Firebase Storage instance.
 */
export function createFirebaseStorageMock() {
	return jasmine.createSpyObj('Storage', ['ref', 'upload']);
}

/**
 * Creates a mock Firebase Analytics instance.
 */
export function createFirebaseAnalyticsMock() {
	return jasmine.createSpyObj('Analytics', [
		'logEvent',
		'setCurrentScreen',
		'setUserId',
	]);
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
export function createActivatedRouteMock() {
	return {
		snapshot: {
			params: {},
			queryParams: {},
			data: {},
		},
		params: of({}),
		queryParams: of({}),
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
