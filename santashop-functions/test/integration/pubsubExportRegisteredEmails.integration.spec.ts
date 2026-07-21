import { beforeEach, describe, expect, it } from 'vitest';
import pubsubExportRegisteredEmails from '../../src/fn/pubsubExportRegisteredEmails';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	createTimestamp,
	setDocument,
} from '../helpers/admin-emulator';

describe.sequential('pubsubExportRegisteredEmails integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('exports registered customer emails to storage', async () => {
		await setDocument(COLLECTION_SCHEMA.registrations, 'reg-1', {
			emailAddress: 'buddy.elf@example.com',
			firstName: 'Buddy',
			lastName: 'Elf',
			zipCode: '80205',
			registrationSubmittedOn: createTimestamp(
				'2025-12-01T00:00:00.000Z',
			),
		});

		const result = await pubsubExportRegisteredEmails();

		expect(result).toBe('Upload successful');
	});
});
