import { beforeEach, describe, expect, it } from 'vitest';
import updateEmailAddress from '../../src/fn/updateEmailAddress';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	getAuth,
	getDocument,
	seedAuthUser,
	setDocument,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';

describe.sequential('updateEmailAddress integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('updates the email address across auth and firestore documents', async () => {
		await seedAuthUser({
			uid: 'user-email-1',
			email: 'old.email@example.com',
			displayName: 'Buddy Elf',
		});
		await setDocument(COLLECTION_SCHEMA.users, 'user-email-1', {
			emailAddress: 'old.email@example.com',
		});
		await setDocument(
			COLLECTION_SCHEMA.registrationSearchIndex,
			'user-email-1',
			{
				emailAddress: 'old.email@example.com',
			},
		);
		await setDocument(COLLECTION_SCHEMA.registrations, 'user-email-1', {
			emailAddress: 'old.email@example.com',
		});

		const result = await updateEmailAddress(
			createCallableRequest(
				{ emailAddress: 'new.email@example.com' },
				{
					uid: 'user-email-1',
					email: 'old.email@example.com',
				},
			),
		);

		expect(result).toBe(true);
		const authUser = await getAuth().getUser('user-email-1');
		expect(authUser.email).toBe('new.email@example.com');
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrationSearchIndex,
				'user-email-1',
			),
		).toMatchObject({ emailAddress: 'new.email@example.com' });
	});
});
