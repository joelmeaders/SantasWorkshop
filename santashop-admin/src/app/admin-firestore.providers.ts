import { inject, Provider } from '@angular/core';
import {
	AppStateService,
	FIREBASE_APP,
	FIREBASE_FIRESTORE,
	FireRepoLite,
	FirestoreWrapper,
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
import {
	ADMIN_FIRESTORE_LITE,
	AdminReadRepository,
} from './shared/services/admin-read-repository.service';
import {
	connectFirestoreEmulator as connectLiteEmulator,
	getFirestore as getLiteFirestore,
	type Firestore as LiteFirestore,
} from 'firebase/firestore/lite';

const connectedLiteInstances = new WeakSet<LiteFirestore>();

export const ADMIN_FIRESTORE_ROUTE_PROVIDERS: Provider[] = [
	{
		provide: ADMIN_FIRESTORE_LITE,
		useFactory: (): LiteFirestore => {
			const firestore = getLiteFirestore(inject(FIREBASE_APP));
			if (!config.production && !connectedLiteInstances.has(firestore)) {
				connectLiteEmulator(
					firestore,
					'127.0.0.1',
					config.emulatorPorts.firestore,
				);
				connectedLiteInstances.add(firestore);
			}
			return firestore;
		},
	},
	AdminReadRepository,
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
	AppStateService,
	DateTimeModalService,
	SearchService,
	StaffService,
	LookupService,
	ScanRiskService,
];
