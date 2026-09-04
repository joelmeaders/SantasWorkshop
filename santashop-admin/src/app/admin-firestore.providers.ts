import { inject, Provider } from '@angular/core';
import {
	AppStateService,
	FIREBASE_APP,
	FIREBASE_FIRESTORE,
	FireRepoLite,
	FirestoreWrapper,
	PUBLIC_PARAMETERS_SOURCE,
	RealtimePublicParametersSource,
} from '@santashop/core/admin/firestore';
import {
	connectFirestoreEmulator,
	getFirestore,
	initializeFirestore,
} from 'firebase/firestore';
import { config } from '../config';
import { SearchService } from './pages/admin/search/search.service';
import { StaffService } from './pages/admin/users/staff.service';
import { DateTimeModalService } from './shared/components/date-time-modal/date-time-modal.service';
import { LookupService } from './shared/services/lookup.service';
import { ScanRiskService } from './shared/services/scan-risk.service';
import { initializeAdminFirestore } from './initialize-admin-firestore';

export const ADMIN_FIRESTORE_ROUTE_PROVIDERS: Provider[] = [
	{
		provide: FIREBASE_FIRESTORE,
		useFactory: () =>
			initializeAdminFirestore(inject(FIREBASE_APP), config, {
				connectFirestoreEmulator,
				getFirestore,
				initializeFirestore,
			}),
	},
	FirestoreWrapper,
	FireRepoLite,
	RealtimePublicParametersSource,
	{
		provide: PUBLIC_PARAMETERS_SOURCE,
		useExisting: RealtimePublicParametersSource,
	},
	AppStateService,
	DateTimeModalService,
	SearchService,
	StaffService,
	LookupService,
	ScanRiskService,
];
