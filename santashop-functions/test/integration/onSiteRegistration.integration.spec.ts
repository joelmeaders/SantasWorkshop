import { beforeEach, describe, expect, it } from 'vitest';
import onSiteRegistration from '../../src/fn/onSiteRegistration';
import { CheckInAggregatedStats, COLLECTION_SCHEMA } from '@santashop/models';
import { createRegistration } from '../fixtures/factories';
import {
	clearEmulatorData,
	getDocument,
	getCollectionCount,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';
import { PROGRAM_YEAR } from '../../src/utility/runtime-config';

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
		const stats = await getDocument<CheckInAggregatedStats>(
			COLLECTION_SCHEMA.stats,
			`checkin-${PROGRAM_YEAR}`,
		);
		expect(stats?.dateTimeCount).toHaveLength(1);
		expect(stats?.dateTimeCount[0]).toMatchObject({
			customerCount: 1,
			childCount: 1,
			pregisteredCount: 0,
			modifiedCount: 1,
		});
	});
});
