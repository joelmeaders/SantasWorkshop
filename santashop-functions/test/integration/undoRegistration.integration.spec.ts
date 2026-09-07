import { beforeEach, describe, expect, it } from 'vitest';
import undoRegistration from '../../src/fn/undoRegistration';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	createTimestamp,
	getCollectionCount,
	getDocument,
	getFirestore,
	seedQrCode,
	setDocument,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';

describe.sequential('undoRegistration integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('cancels a completed registration while preserving its seasonal QR', async () => {
		const qrCodeStoragePath = 'registrations/user-undo-1/code.png';
		await seedQrCode(qrCodeStoragePath);
		await setDocument(COLLECTION_SCHEMA.parameters, 'public', {
			admin: { allowCancelRegistration: true },
		});
		await setDocument(COLLECTION_SCHEMA.registrations, 'user-undo-1', {
			uid: 'user-undo-1',
			qrcode: 'ABCD2345',
			qrCodeStoragePath,
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
		await setDocument(
			COLLECTION_SCHEMA.tmpRegistrationEmails,
			'user-undo-1',
			{
				email: 'customer@example.com',
				name: 'Customer',
				code: 'ABCD2345',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
			},
		);

		const result = await undoRegistration(
			createCallableRequest(
				{ mutationId: 'cancel-user-0001' },
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
		const registration = await getDocument<Record<string, unknown>>(
			COLLECTION_SCHEMA.registrations,
			'user-undo-1',
		);
		expect(registration?.['qrcode']).toBe('ABCD2345');
		expect(registration?.['qrCodeStoragePath']).toBe(qrCodeStoragePath);
		expect(registration?.['registrationSubmittedOn']).toBeUndefined();
		expect(await getCollectionCount(COLLECTION_SCHEMA.cancellations)).toBe(
			1,
		);
		const cancellationSnapshot = await getFirestore()
			.collection(COLLECTION_SCHEMA.cancellations)
			.get();
		expect(cancellationSnapshot.docs[0].data()).toMatchObject({
			supersededConfirmationCode: 'ABCD2345',
			replacementConfirmationCode: 'ABCD2345',
			supersededQrCodeStoragePath: qrCodeStoragePath,
			replacementQrCodeStoragePath: qrCodeStoragePath,
		});
		const queuedEmails = await getFirestore()
			.collection(COLLECTION_SCHEMA.tmpRegistrationEmails)
			.get();
		expect(queuedEmails.size).toBe(2);
		expect(
			queuedEmails.docs
				.find(
					(document) =>
						document.data()['queueSource'] ===
						'registration-cancellation',
				)
				?.data(),
		).toMatchObject({
			registrationUid: 'user-undo-1',
			queueSource: 'registration-cancellation',
			code: 'ABCD2345',
		});
	});
});
