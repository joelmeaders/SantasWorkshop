import { beforeEach, describe, expect, it } from 'vitest';
import updateReferredBy from '../../src/fn/updateReferredBy';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	getDocument,
	seedAuthUser,
	setDocument,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';

describe.sequential('updateReferredBy integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('updates the referredBy field for the current user', async () => {
		await seedAuthUser({
			uid: 'user-ref-1',
			email: 'buddy.elf@example.com',
		});
		await setDocument(COLLECTION_SCHEMA.users, 'user-ref-1', {
			firstName: 'Buddy',
			lastName: 'Elf',
		});

		const result = await updateReferredBy(
			createCallableRequest(
				{ referredBy: 'School Counselor' },
				{ uid: 'user-ref-1' },
			),
		);

		expect(result).toBe(true);
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.users,
				'user-ref-1',
			),
		).toMatchObject({ referredBy: 'School Counselor' });
	});
});
