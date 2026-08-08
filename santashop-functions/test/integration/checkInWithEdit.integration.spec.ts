import { beforeEach, describe, expect, it } from 'vitest';
import checkInWithEdit from '../../src/fn/checkInWithEdit';
import { COLLECTION_SCHEMA, type CheckInRequest } from '@santashop/models';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { createRegistration } from '../fixtures/factories';
import {
	clearEmulatorData,
	getDocument,
	getCollectionCount,
	setDocument,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';

describe.sequential('checkInWithEdit integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('stores edited registrations during check-in with edit', async () => {
		await setDocument(
			COLLECTION_SCHEMA.registrations,
			'edited-user-1',
		createRegistration({ uid: 'edited-user-1', registrationSubmittedOn: new Date() }),
		);
		const result = await checkInWithEdit(
			createCallableRequest(
				{
					registration: createRegistration({ uid: 'edited-user-1', registrationSubmittedOn: new Date() }),
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
				COLLECTION_SCHEMA.editedRegistrations,
				'edited-user-1',
			),
		).toMatchObject({ uid: 'edited-user-1' });
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrations,
				'edited-user-1',
			),
		).toMatchObject({ hasCheckedIn: true });
	});

	it('allows only one real Firestore transaction when check-in variants race', async () => {
		const registration = createRegistration({
			uid: 'checkin-race-user',
			registrationSubmittedOn: new Date(),
		});
		await setDocument(COLLECTION_SCHEMA.registrations, registration.uid!, registration);
		const request = (inputMethod: 'camera' | 'manual'): CallableRequest<CheckInRequest> => createCallableRequest(
			{ registration, inputMethod },
			{ admin: true, uid: `scanner-${inputMethod}` },
		);

		const outcomes = await Promise.allSettled([
			checkInWithEdit(request('manual')),
			(await import('../../src/fn/checkIn')).default(request('camera')),
		]);

		expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
		expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
		expect(await getCollectionCount(COLLECTION_SCHEMA.checkins)).toBe(1);
		expect(await getCollectionCount(COLLECTION_SCHEMA.registrationScanAttempts)).toBe(1);
		const storedRegistration = await getDocument<Record<string, unknown>>(
			COLLECTION_SCHEMA.registrations,
			registration.uid!,
		);
		expect(storedRegistration).toMatchObject({ hasCheckedIn: true });
	});
});
