import { beforeEach, describe, expect, it } from 'vitest';
import undoRegistration from '../../src/fn/undoRegistration';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	createTimestamp,
	getCollectionCount,
	getDocument,
	setDocument,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';

describe.sequential('undoRegistration integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('cancels a completed registration with an immutable operational record', async () => {
		await setDocument(COLLECTION_SCHEMA.parameters, 'public', {
			admin: { allowCancelRegistration: true },
		});
		await setDocument(COLLECTION_SCHEMA.registrations, 'user-undo-1', {
			uid: 'user-undo-1',
			qrcode: 'ABCD2345',
			firstName: 'Customer',
			emailAddress: 'customer@example.com',
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
		await setDocument(COLLECTION_SCHEMA.tmpRegistrationEmails, 'user-undo-1', {
			email: 'customer@example.com',
			name: 'Customer',
			code: 'ABCD2345',
			formattedDateTime: 'Wednesday, December 10, 6:00 PM',
		});

		const result = await undoRegistration(
			createCallableRequest({}, { uid: 'user-undo-1' }),
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
		const registration = await getDocument<Record<string, unknown>>(
			COLLECTION_SCHEMA.registrations,
			'user-undo-1',
		);
		expect(registration?.['qrcode']).not.toBe('ABCD2345');
		expect(registration?.['registrationSubmittedOn']).toBeUndefined();
		expect(await getCollectionCount(COLLECTION_SCHEMA.cancellations)).toBe(1);
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.tmpRegistrationEmails,
				'user-undo-1',
			),
		).toMatchObject({ queueSource: 'registration-cancellation' });
	});
});
