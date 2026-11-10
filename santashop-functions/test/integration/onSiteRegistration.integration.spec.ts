import { beforeEach, describe, expect, it, vi } from 'vitest';
import onSiteRegistration from '../../src/fn/onSiteRegistration';
import { CheckInAggregatedStats, COLLECTION_SCHEMA } from '@santashop/models';
import { createRegistration } from '../fixtures/factories';
import {
	clearEmulatorData,
	getFirestore,
	getDocument,
	getCollectionCount,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';
import { PROGRAM_YEAR } from '../../src/utility/runtime-config';

const onsite = (overrides: Parameters<typeof createRegistration>[0] = {}) => ({
	...createRegistration(overrides),
	mutationId: 'onsite-test-1',
});

describe.sequential('onSiteRegistration integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('creates an onsite registration and check-in record', async () => {
		const result = await onSiteRegistration(
			createCallableRequest(onsite({ uid: 'onsite-input' }), {
				roles: ['admin', 'checkin'],
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
	it('recovers a committed submission after a lost response without duplicate check-ins or totals', async () => {
		const db = getFirestore();
		const request = createCallableRequest(onsite(), {
			uid: 'staff-1',
			roles: ['admin'],
		});
		const transact = db.runTransaction.bind(db);
		const spy = vi
			.spyOn(db, 'runTransaction')
			.mockImplementationOnce(
				async (...args: Parameters<typeof db.runTransaction>) => {
					await transact(...args);
					throw new Error('Lost acknowledgement after commit');
				},
			);
		await expect(onSiteRegistration(request)).rejects.toThrow(
			'Lost acknowledgement',
		);
		spy.mockRestore();
		const original = await db
			.collection(COLLECTION_SCHEMA.onSiteRegistrations)
			.get();
		expect(original.size).toBe(1);
		const before = original.docs[0].data();
		expect(
			await Promise.all([
				onSiteRegistration(request),
				onSiteRegistration(request),
				onSiteRegistration(request),
			]),
		).toEqual([1, 1, 1]);
		expect(
			await getCollectionCount(COLLECTION_SCHEMA.onSiteRegistrations),
		).toBe(1);
		expect(await getCollectionCount(COLLECTION_SCHEMA.checkins)).toBe(1);
		expect((await original.docs[0].ref.get()).data()).toEqual(before);
		const stats = await getDocument<CheckInAggregatedStats>(
			COLLECTION_SCHEMA.stats,
			`checkin-${PROGRAM_YEAR}`,
		);
		expect(stats?.dateTimeCount[0]).toMatchObject({
			customerCount: 1,
			childCount: 1,
		});
		await expect(
			onSiteRegistration({
				...request,
				data: { ...request.data, firstName: 'Different' },
			}),
		).rejects.toMatchObject({ code: 'already-exists' });
		await onSiteRegistration({
			...request,
			data: { ...request.data, mutationId: 'new-family-2' },
		});
		expect(
			await getCollectionCount(COLLECTION_SCHEMA.onSiteRegistrations),
		).toBe(2);
		await onSiteRegistration({
			...request,
			auth: { ...request.auth!, uid: 'staff-2' },
		});
		expect(
			await getCollectionCount(COLLECTION_SCHEMA.onSiteRegistrations),
		).toBe(3);
	});
});
