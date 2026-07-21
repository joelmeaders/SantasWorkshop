import { beforeEach, describe, expect, it } from 'vitest';
import completeRegistration from '../../src/fn/completeRegistration';
import { COLLECTION_SCHEMA } from '@santashop/models';
import { createRegistration } from '../fixtures/factories';
import { clearEmulatorData, getDocument } from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';

describe.sequential('completeRegistration integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('completes a registration and writes email/search index records', async () => {
		const record = createRegistration({ uid: 'user-reg-1' });

		const result = await completeRegistration(
			createCallableRequest(record, { uid: 'user-reg-1' }),
		);

		expect(result).toBe(true);
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrations,
				'user-reg-1',
			),
		).toMatchObject({
			programYear: 2025,
			includedInCounts: false,
			includedInRegistrationStats: false,
		});
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.tmpRegistrationEmails,
				'user-reg-1',
			),
		).toMatchObject({
			code: 'ABCD2345',
			email: 'buddy.elf@example.com',
			name: 'Buddy',
		});
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrationSearchIndex,
				'user-reg-1',
			),
		).toMatchObject({ customerId: 'user-reg-1', code: 'ABCD2345' });
	});
});
