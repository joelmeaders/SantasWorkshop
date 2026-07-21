import { beforeEach, describe, expect, it } from 'vitest';
import callableAdminPreRegister from '../../src/fn/callableAdminPreRegister';
import { COLLECTION_SCHEMA } from '@santashop/models';
import { createRegistration } from '../fixtures/factories';
import {
	clearEmulatorData,
	createTimestamp,
	getAuth,
	getDocument,
	setDocument,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';

describe.sequential('callableAdminPreRegister integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('pre-registers a user as an admin and persists related records', async () => {
		await setDocument(COLLECTION_SCHEMA.dateTimeSlots, 'slot-1', {
			dateTime: createTimestamp('2025-12-10T18:00:00.000Z'),
			programYear: 2025,
			maxSlots: 350,
			enabled: true,
		});

		const uid = await callableAdminPreRegister(
			createCallableRequest(
				createRegistration({
					emailAddress: 'pre.reg@example.com',
					dateTimeSlot: {
						id: 'slot-1',
						dateTime: new Date('2025-12-10T18:00:00.000Z'),
					},
				}),
				{ admin: true, uid: 'admin-user' },
			),
		);

		const authUser = await getAuth().getUser(uid);
		expect(authUser.email).toBe('pre.reg@example.com');
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.users,
				uid,
			),
		).toMatchObject({ emailAddress: 'pre.reg@example.com' });
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.tmpRegistrationEmails,
				uid,
			),
		).toMatchObject({ email: 'pre.reg@example.com' });
		expect(
			(
				await getDocument<Record<string, unknown>>(
					COLLECTION_SCHEMA.tmpRegistrationEmails,
					uid,
				)
			)?.['deliveryState'],
		).toMatch(/queued|sending|sent/);
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrations,
				uid,
			),
		).toMatchObject({
			qrCodeGeneratedOn: expect.anything(),
			reminderEmailQueuedOn: expect.anything(),
		});
	});
});
