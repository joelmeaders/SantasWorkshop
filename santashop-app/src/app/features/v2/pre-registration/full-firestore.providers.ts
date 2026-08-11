import { inject, Provider } from '@angular/core';
import {
	FIREBASE_APP,
	FIREBASE_AUTH,
	FIREBASE_FIRESTORE,
	FIREBASE_FUNCTIONS,
	FIREBASE_STORAGE,
	AnalyticsWrapper,
	AppStateService,
	AuthService,
	ErrorHandlerService,
	FireRepoLite,
	FirestoreWrapper,
	FunctionsWrapper,
	MOBILE_EVENT,
	PROFILE_VERSION,
	PROGRAM_YEAR,
	SHOP_DAYS,
	StorageWrapper,
} from '@santashop/core';
import {
	FIREBASE_APP as CUSTOMER_FIREBASE_APP,
	FIREBASE_AUTH as CUSTOMER_FIREBASE_AUTH,
	FIREBASE_FUNCTIONS as CUSTOMER_FIREBASE_FUNCTIONS,
	FIREBASE_STORAGE as CUSTOMER_FIREBASE_STORAGE,
	AnalyticsWrapper as CustomerAnalyticsWrapper,
	AppStateService as CustomerAppStateService,
	AuthService as CustomerAuthService,
	ErrorHandlerService as CustomerErrorHandlerService,
	FunctionsWrapper as CustomerFunctionsWrapper,
	StorageWrapper as CustomerStorageWrapper,
} from '@santashop/core/customer';
import {
	connectFirestoreEmulator,
	getFirestore,
} from 'firebase/firestore';
import { CheckedInGuard } from '../../../core/guards/checked-in.guard';
import { RegistrationCompleteGuard } from '../../../core/guards/registration-complete.guard';
import { RegistrationIncompleteGuard } from '../../../core/guards/registration-incomplete.guard';
import { CheckinService } from '../../../core/services/checkin.service';
import { PreRegistrationService } from '../../../core/services/pre-registration.service';
import { QrCodeService } from '../../../core/services/qrcode.service';
import { CUSTOMER_APP_CONFIG } from '../../../core/tokens/customer-runtime.token';
import { ProfilePageService } from './profile/profile.page.service';
import { initializeFullFirestore } from './initialize-full-firestore';

export const FULL_FIRESTORE_ROUTE_PROVIDERS: Provider[] = [
	{ provide: FIREBASE_APP, useExisting: CUSTOMER_FIREBASE_APP },
	{ provide: FIREBASE_AUTH, useExisting: CUSTOMER_FIREBASE_AUTH },
	{ provide: FIREBASE_FUNCTIONS, useExisting: CUSTOMER_FIREBASE_FUNCTIONS },
	{ provide: FIREBASE_STORAGE, useExisting: CUSTOMER_FIREBASE_STORAGE },
	{ provide: AuthService, useExisting: CustomerAuthService },
	{ provide: AnalyticsWrapper, useExisting: CustomerAnalyticsWrapper },
	{ provide: AppStateService, useExisting: CustomerAppStateService },
	{ provide: ErrorHandlerService, useExisting: CustomerErrorHandlerService },
	{ provide: FunctionsWrapper, useExisting: CustomerFunctionsWrapper },
	{ provide: StorageWrapper, useExisting: CustomerStorageWrapper },
	{
		provide: PROGRAM_YEAR,
		useFactory: () => inject(CUSTOMER_APP_CONFIG).programYear,
	},
	{
		provide: SHOP_DAYS,
		useFactory: () => inject(CUSTOMER_APP_CONFIG).shopDays,
	},
	{ provide: PROFILE_VERSION, useValue: 1 },
	{ provide: MOBILE_EVENT, useValue: true },
	{
		provide: FIREBASE_FIRESTORE,
		useFactory: () =>
			initializeFullFirestore(
				inject(FIREBASE_APP),
				inject(CUSTOMER_APP_CONFIG),
				{ connectFirestoreEmulator, getFirestore },
			),
	},
	FirestoreWrapper,
	FireRepoLite,
	PreRegistrationService,
	QrCodeService,
	CheckinService,
	ProfilePageService,
	CheckedInGuard,
	RegistrationCompleteGuard,
	RegistrationIncompleteGuard,
];
