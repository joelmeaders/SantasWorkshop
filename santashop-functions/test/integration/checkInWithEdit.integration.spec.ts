import { beforeEach, describe, expect, it } from 'vitest';
import checkInWithEdit from '../../src/fn/checkInWithEdit';
import { COLLECTION_SCHEMA } from '@santashop/models';
import { createRegistration } from '../fixtures/factories';
import {
	clearEmulatorData,
	getDocument,
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
			createRegistration({ uid: 'edited-user-1' }),
		);
		const result = await checkInWithEdit(
			createCallableRequest(
				createRegistration({ uid: 'edited-user-1' }),
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
});
