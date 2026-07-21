import { beforeEach, describe, expect, it } from 'vitest';
import pubsubExportMarketingEmails from '../../src/fn/pubsubExportMarketingEmails';
import { COLLECTION_SCHEMA } from '@santashop/models';
import { clearEmulatorData, setDocument } from '../helpers/admin-emulator';

describe.sequential('pubsubExportMarketingEmails integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('exports marketing email subscribers to storage', async () => {
		await setDocument(COLLECTION_SCHEMA.users, 'user-1', {
			emailAddress: 'buddy.elf@example.com',
			firstName: 'Buddy',
			lastName: 'Elf',
			zipCode: '80205',
			newsletter: true,
		});

		const result = await pubsubExportMarketingEmails();

		expect(result).toBe('Upload successful');
	});
});
