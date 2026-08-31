import { beforeEach, describe, expect, it } from 'vitest';
import changeAccountInformation from '../../src/fn/changeAccountInformation';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	getAuth,
	getDocument,
	seedAuthUser,
	setDocument,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';

describe.sequential('changeAccountInformation integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('changes account information across auth and firestore', async () => {
		await seedAuthUser({
			uid: 'user-info-1',
			email: 'buddy.elf@example.com',
			displayName: 'Buddy Elf',
		});
		await setDocument(COLLECTION_SCHEMA.users, 'user-info-1', {
			firstName: 'Buddy',
			lastName: 'Elf',
			zipCode: 80205,
		});
		await setDocument(
			COLLECTION_SCHEMA.registrationSearchIndex,
			'user-info-1',
			{
				firstName: 'buddy',
				lastName: 'elf',
				zip: 80205,
			},
		);
		await setDocument(COLLECTION_SCHEMA.registrations, 'user-info-1', {
			firstName: 'Buddy',
			lastName: 'Elf',
			zipCode: 80205,
		});

		const result = await changeAccountInformation(
			createCallableRequest(
				{ firstName: 'Jovie', lastName: 'Hobbs', zipCode: 80212 },
				{ uid: 'user-info-1' },
			),
		);

		expect(result).toBe(true);
		const authUser = await getAuth().getUser('user-info-1');
		expect(authUser.displayName).toBe('Jovie Hobbs');
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.users,
				'user-info-1',
			),
		).toMatchObject({
			firstName: 'Jovie',
			lastName: 'Hobbs',
			zipCode: 80212,
		});
	});
});
