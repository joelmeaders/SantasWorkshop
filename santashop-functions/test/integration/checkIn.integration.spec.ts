import { beforeEach, describe, expect, it } from 'vitest';
import checkIn from '../../src/fn/checkIn';
import { COLLECTION_SCHEMA } from '@santashop/models';
import { createRegistration } from '../fixtures/factories';
import {
	clearEmulatorData,
	getDocument,
	setDocument,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';

describe.sequential('checkIn integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('checks in a registration and stores the check-in record', async () => {
		await setDocument(
			COLLECTION_SCHEMA.registrations,
			'checkin-user-1',
			createRegistration({ uid: 'checkin-user-1' }),
		);
		const result = await checkIn(
			createCallableRequest(
				createRegistration({ uid: 'checkin-user-1' }),
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
		});
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrations,
				'checkin-user-1',
			),
		).toMatchObject({ hasCheckedIn: true });
	});
});
