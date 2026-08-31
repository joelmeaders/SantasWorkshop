import { beforeEach, describe, expect, it } from 'vitest';
import onSiteRegistration from '../../src/fn/onSiteRegistration';
import { COLLECTION_SCHEMA } from '@santashop/models';
import { createRegistration } from '../fixtures/factories';
import {
	clearEmulatorData,
	getCollectionCount,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';

describe.sequential('onSiteRegistration integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('creates an onsite registration and check-in record', async () => {
		const result = await onSiteRegistration(
			createCallableRequest(createRegistration({ uid: 'onsite-input' }), {
				admin: true,
				uid: 'admin-user',
			}),
		);

		expect(result).toBe(1);
		expect(
			await getCollectionCount(COLLECTION_SCHEMA.onSiteRegistrations),
		).toBe(1);
		expect(await getCollectionCount(COLLECTION_SCHEMA.checkins)).toBe(1);
	});
});
