import { beforeEach, describe, expect, it } from 'vitest';
import undoRegistration from '../../src/fn/undoRegistration';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	createTimestamp,
	getDocument,
	setDocument,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';

describe.sequential('undoRegistration integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('undoes a completed registration and clears the search index', async () => {
		await setDocument(COLLECTION_SCHEMA.registrations, 'user-undo-1', {
			uid: 'user-undo-1',
			qrcode: 'ABCD2345',
			dateTimeSlot: {
				id: 'slot-1',
				dateTime: '2025-12-10T18:00:00.000Z',
			},
			registrationSubmittedOn: createTimestamp(
				'2025-12-01T00:00:00.000Z',
			),
			includedInCounts: true,
		});
		await setDocument(
			COLLECTION_SCHEMA.registrationSearchIndex,
			'user-undo-1',
			{
				customerId: 'user-undo-1',
			},
		);

		const result = await undoRegistration(
			createCallableRequest(
				{ uid: 'user-undo-1' },
				{ uid: 'user-undo-1' },
			),
		);

		expect(result).toBe(true);
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrationSearchIndex,
				'user-undo-1',
			),
		).toBeUndefined();
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrations,
				'user-undo-1',
			),
		).toMatchObject({
			includedInCounts: false,
			previousDateTimeSlot: {
				id: 'slot-1',
				dateTime: '2025-12-10T18:00:00.000Z',
			},
		});
	});
});
