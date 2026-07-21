import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import newAccount from '../../src/fn/newAccount';
import { COLLECTION_SCHEMA } from '@santashop/models';
import { createOnboardUser } from '../fixtures/factories';
import { createCallableRequest } from '../helpers/callable-context';
import {
	clearEmulatorData,
	getAuth,
	getFirestore,
} from '../helpers/admin-emulator';

describe.sequential('newAccount integration', () => {
	beforeAll(() => {
		getFirestore();
	});

	beforeEach(async () => {
		await clearEmulatorData();
	});

	afterAll(async () => {
		await clearEmulatorData();
	});

	it('creates auth and firestore records when creating a new account', async () => {
		const onboardUser = createOnboardUser({
			emailAddress: 'integration.buddy.elf@example.com',
		});

		const uid = await newAccount(createCallableRequest(onboardUser));

		const authUser = await getAuth().getUser(uid);
		const userDocument = await getFirestore()
			.collection(COLLECTION_SCHEMA.users)
			.doc(uid)
			.get();
		const registrationDocument = await getFirestore()
			.collection(COLLECTION_SCHEMA.registrations)
			.doc(uid)
			.get();

		expect(authUser.email).toBe('integration.buddy.elf@example.com');
		expect(userDocument.exists).toBe(true);
		expect(userDocument.data()).toMatchObject({
			firstName: 'Buddy',
			lastName: 'Elf',
			emailAddress: 'integration.buddy.elf@example.com',
			newsletter: true,
		});
		expect(registrationDocument.exists).toBe(true);
		expect(registrationDocument.data()).toMatchObject({
			uid,
			firstName: 'Buddy',
			lastName: 'Elf',
			emailAddress: 'integration.buddy.elf@example.com',
			zipCode: 80205,
		});
	});

	it('surfaces an already-exists error when creating the same account twice', async () => {
		const onboardUser = createOnboardUser({
			emailAddress: 'duplicate.integration@example.com',
		});

		await newAccount(createCallableRequest(onboardUser));

		await expect(
			newAccount(createCallableRequest(onboardUser)),
		).rejects.toMatchObject({ code: 'already-exists' });
	});
});
