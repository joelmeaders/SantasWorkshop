import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	firestore: vi.fn(),
	auth: vi.fn(),
	storage: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	doc: vi.fn(),
	collection: vi.fn(),
}));

vi.mock('../../../src/firebase-admin', () => ({
	default: {
		firestore: mocks.firestore,
		auth: mocks.auth,
		storage: mocks.storage,
	},
}));

import {
	inspectRegistrationBoundary,
	updateDateTimeSlot,
} from '../../../src/fn/testBoundaryHelpers';
import { COLLECTION_SCHEMA } from '../../../src/models';

describe('boundary fixture emulator guards', () => {
	beforeEach(() => {
		vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
		vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
		vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');
		vi.stubEnv('FIREBASE_STORAGE_EMULATOR_HOST', '127.0.0.1:9199');
		mocks.firestore.mockReturnValue({ collection: mocks.collection });
		mocks.collection.mockReturnValue({ doc: mocks.doc });
		mocks.doc.mockReturnValue({
			update: mocks.update,
			delete: mocks.delete,
		});
		mocks.update.mockResolvedValue(undefined);
		mocks.delete.mockResolvedValue(undefined);
	});

	afterEach(() => vi.unstubAllEnvs());

	it.each([
		['FUNCTIONS_EMULATOR', undefined],
		['FUNCTIONS_EMULATOR', 'false'],
		['FIRESTORE_EMULATOR_HOST', undefined],
		['FIREBASE_AUTH_EMULATOR_HOST', undefined],
		['FIREBASE_STORAGE_EMULATOR_HOST', undefined],
		['FIRESTORE_EMULATOR_HOST', 'firestore.googleapis.com:443'],
		['FIREBASE_AUTH_EMULATOR_HOST', 'identitytoolkit.googleapis.com:443'],
		['FIREBASE_STORAGE_EMULATOR_HOST', 'storage.googleapis.com:443'],
	])(
		'rejects inspection and mutation before SDK access with %s=%s',
		async (key, value) => {
			vi.stubEnv(key, value);
			await expect(
				inspectRegistrationBoundary('fixture@example.com'),
			).rejects.toMatchObject({ code: 'failed-precondition' });
			await expect(
				updateDateTimeSlot('fixture-slot', { deleted: true }),
			).rejects.toMatchObject({ code: 'failed-precondition' });
			expect(mocks.firestore).not.toHaveBeenCalled();
			expect(mocks.auth).not.toHaveBeenCalled();
			expect(mocks.storage).not.toHaveBeenCalled();
			expect(mocks.delete).not.toHaveBeenCalled();
		},
	);

	it('updates only the selected existing local slot using a Firestore-compatible date', async () => {
		await updateDateTimeSlot('fixture-slot', {
			enabled: false,
			dateTime: '2025-12-10T18:00:00.000Z',
			programYear: 2025,
			maxSlots: 4,
		});
		expect(mocks.collection).toHaveBeenCalledWith(
			COLLECTION_SCHEMA.dateTimeSlots,
		);
		expect(mocks.doc).toHaveBeenCalledWith('fixture-slot');
		expect(mocks.update).toHaveBeenCalledWith({
			enabled: false,
			dateTime: new Date('2025-12-10T18:00:00.000Z'),
			programYear: 2025,
			maxSlots: 4,
		});
		expect(mocks.delete).not.toHaveBeenCalled();
	});

	it('rejects invalid fixture inputs without writing', async () => {
		await expect(
			inspectRegistrationBoundary('not-an-email'),
		).rejects.toMatchObject({ code: 'invalid-argument' });
		await expect(
			updateDateTimeSlot('other/collection', { deleted: true }),
		).rejects.toMatchObject({ code: 'invalid-argument' });
		await expect(
			updateDateTimeSlot('fixture-slot', { dateTime: 'not-a-date' }),
		).rejects.toMatchObject({ code: 'invalid-argument' });
		expect(mocks.update).not.toHaveBeenCalled();
		expect(mocks.delete).not.toHaveBeenCalled();
	});
});
