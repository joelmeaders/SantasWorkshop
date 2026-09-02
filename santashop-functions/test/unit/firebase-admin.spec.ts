import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const initializeAppMock = vi.fn();
const originalFirebaseConfig = process.env.FIREBASE_CONFIG;
const originalServiceAccount =
	process.env.SANTASHOP_FUNCTIONS_SERVICE_ACCOUNT;

describe('Firebase Admin initialization', () => {
	beforeEach(() => {
		vi.resetModules();
		initializeAppMock.mockReset();
		process.env.FIREBASE_CONFIG = JSON.stringify({
			projectId: 'santas-workshop-test',
			storageBucket: 'santas-workshop-test.appspot.com',
		});
		process.env.SANTASHOP_FUNCTIONS_SERVICE_ACCOUNT =
			'312672416598-compute@developer.gserviceaccount.com';
		vi.doMock('firebase-admin', () => ({
			apps: [],
			initializeApp: initializeAppMock,
		}));
	});

	afterEach(() => {
		if (originalFirebaseConfig === undefined) {
			delete process.env.FIREBASE_CONFIG;
		} else {
			process.env.FIREBASE_CONFIG = originalFirebaseConfig;
		}
		if (originalServiceAccount === undefined) {
			delete process.env.SANTASHOP_FUNCTIONS_SERVICE_ACCOUNT;
		} else {
			process.env.SANTASHOP_FUNCTIONS_SERVICE_ACCOUNT =
				originalServiceAccount;
		}
	});

	it('passes the configured runtime identity to the Admin SDK', async () => {
		await import('../../src/firebase-admin');

		expect(initializeAppMock).toHaveBeenCalledWith({
			projectId: 'santas-workshop-test',
			storageBucket: 'santas-workshop-test.appspot.com',
			serviceAccountId:
				'312672416598-compute@developer.gserviceaccount.com',
		});
	});
});
