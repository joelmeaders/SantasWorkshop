import { beforeEach, describe, expect, it } from 'vitest';
import checkIn from '../../src/fn/checkIn';
import { COLLECTION_SCHEMA } from '@santashop/models';
import { createRegistration } from '../fixtures/factories';
import {
	clearEmulatorData,
	getDocument,
	getCollectionCount,
	getFirestore,
	setDocument,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';
import { PROGRAM_YEAR } from '../../src/utility/runtime-config';

describe.sequential('checkIn integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('checks in a registration and stores the check-in record', async () => {
		await setDocument(
			COLLECTION_SCHEMA.registrations,
			'checkin-user-1',
			createRegistration({
				uid: 'checkin-user-1',
				registrationSubmittedOn: new Date(),
			}),
		);
		const result = await checkIn(
			createCallableRequest(
				{
					registration: createRegistration({
						uid: 'checkin-user-1',
						registrationSubmittedOn: new Date(),
					}),
					inputMethod: 'manual',
				},
				{
					admin: true,
					uid: 'admin-user',
				},
			),
		);

		expect(result).toBe(1);
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.checkins,
				'checkin-user-1',
			),
		).toMatchObject({
			customerId: 'checkin-user-1',
			registrationCode: 'ABCD2345',
			inStats: true,
		});
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrations,
				'checkin-user-1',
			),
		).toMatchObject({ hasCheckedIn: true });
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.stats,
				`checkin-${PROGRAM_YEAR}`,
			),
		).toMatchObject({
			dateTimeCount: [
				expect.objectContaining({
					customerCount: 1,
					childCount: 1,
				}),
			],
		});
	});

	it('persists a late duplicate risk summary without persisting a raw code', async () => {
		const registration = createRegistration({
			uid: 'late-duplicate-user',
			registrationSubmittedOn: new Date(),
		});
		await setDocument(
			COLLECTION_SCHEMA.registrations,
			registration.uid!,
			registration,
		);
		await setDocument(COLLECTION_SCHEMA.checkins, registration.uid!, {
			customerId: registration.uid,
			registrationCode: registration.qrcode,
			checkInDateTime: new Date(Date.now() - 6 * 60 * 1000),
			inStats: false,
			stats: { children: 1 },
		});

		await expect(
			checkIn(
				createCallableRequest(
					{ registration, inputMethod: 'manual' },
					{ admin: true, uid: 'auditor-user' },
				),
			),
		).rejects.toMatchObject({ code: 'already-exists' });

		expect(
			await getCollectionCount(
				COLLECTION_SCHEMA.registrationScanAttempts,
			),
		).toBe(1);
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrationScanRiskSummaries,
				`${PROGRAM_YEAR}_${registration.uid}`,
			),
		).toMatchObject({
			customerId: registration.uid,
			lateDuplicateAttemptCount: 1,
			totalRiskAttemptCount: 1,
		});
		const attempts = await getFirestore()
			.collection(COLLECTION_SCHEMA.registrationScanAttempts)
			.get();
		expect(attempts.docs[0].data()).not.toHaveProperty('code');
		expect(attempts.docs[0].data()).not.toHaveProperty('rawCode');
	});
});
