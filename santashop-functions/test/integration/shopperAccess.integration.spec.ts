import { beforeEach, describe, expect, it } from 'vitest';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	getShopperAccessStatus,
	getAdminShopperAccess,
	setShopperAccess,
} from '../../src/fn/shopperAccess';
import {
	clearEmulatorData,
	createTimestamp,
	getAuth,
	getCollectionCount,
	getDocument,
	getFirestore,
	seedAuthUser,
	setDocument,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';

const shopperUid = 'synthetic-shopper-access';
const shopper = { uid: shopperUid };
const owner = { uid: 'synthetic-owner', owner: true };
const disable = {
	uid: shopperUid,
	disabled: true,
	reason: 'duplicate-registration',
	evidenceId: 'synthetic-scan-evidence',
};

describe.sequential('shopper access', () => {
	beforeEach(async () => {
		await clearEmulatorData();
		await seedAuthUser({
			uid: shopperUid,
			email: 'synthetic-shopper@example.com',
		});
		await setDocument(COLLECTION_SCHEMA.users, shopperUid, {});
		await setDocument(COLLECTION_SCHEMA.registrations, shopperUid, {
			registrationSubmittedOn: createTimestamp('2026-11-15T15:00:00Z'),
		});
		await setDocument(
			COLLECTION_SCHEMA.registrationScanAttempts,
			disable.evidenceId,
			{
				customerId: shopperUid,
			},
		);
	});

	it('flags an existing shopper account without cancelling or queueing mail and restores only access', async () => {
		const customerRequest = createCallableRequest({}, shopper);
		const staffRequest = createCallableRequest({ uid: shopperUid }, owner);
		await expect(getAdminShopperAccess(staffRequest)).resolves.toEqual({
			disabled: false,
			audit: null,
		});
		await expect(
			getAdminShopperAccess(
				createCallableRequest({ uid: shopperUid }, shopper),
			),
		).rejects.toMatchObject({ code: 'permission-denied' });
		await expect(
			setShopperAccess(createCallableRequest(disable, owner)),
		).resolves.toEqual({ disabled: true });
		await expect(getShopperAccessStatus(customerRequest)).resolves.toEqual({
			disabled: true,
			hasActiveRegistration: true,
		});
		expect(
			await getDocument(COLLECTION_SCHEMA.shopperAccess, shopperUid),
		).toEqual({ disabled: true });
		expect((await getAuth().getUser(shopperUid)).disabled).toBe(false);
		expect(await getCollectionCount(COLLECTION_SCHEMA.cancellations)).toBe(
			0,
		);
		expect(
			await getCollectionCount(COLLECTION_SCHEMA.tmpRegistrationEmails),
		).toBe(0);

		const enable = createCallableRequest(
			{ uid: shopperUid, disabled: false },
			owner,
		);
		await setShopperAccess(enable);
		await setShopperAccess(enable);
		await expect(getShopperAccessStatus(customerRequest)).resolves.toEqual({
			disabled: false,
			hasActiveRegistration: false,
		});
		await expect(
			getAdminShopperAccess(staffRequest),
		).resolves.toMatchObject({
			disabled: false,
			audit: {
				disposition: 'reviewed-and-cleared',
				updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
			},
		});
		expect(
			await getDocument(COLLECTION_SCHEMA.registrations, shopperUid),
		).toHaveProperty('registrationSubmittedOn');
		const audit = await getFirestore()
			.collection(COLLECTION_SCHEMA.shopperAccess)
			.doc(shopperUid)
			.collection('audit')
			.get();
		expect(audit.size).toBe(3);
		expect(
			audit.docs.find((entry) => entry.id === 'current')?.data(),
		).toMatchObject({
			disabled: false,
			disposition: 'reviewed-and-cleared',
			evidenceId: disable.evidenceId,
			reason: disable.reason,
			updatedBy: owner.uid,
			updatedAt: expect.anything(),
		});
	});

	it('requires Admin access, a valid disable reason, and a nonstaff target', async () => {
		await expect(
			setShopperAccess(
				createCallableRequest(disable, {
					uid: 'checkin',
					roles: ['checkin'],
				}),
			),
		).rejects.toMatchObject({ code: 'permission-denied' });
		await expect(
			setShopperAccess(
				createCallableRequest({ ...disable, reason: 'other' }, owner),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
		await setDocument(COLLECTION_SCHEMA.staff, shopperUid, {});
		await expect(
			setShopperAccess(createCallableRequest(disable, owner)),
		).rejects.toMatchObject({ code: 'permission-denied' });
	});
	it('allows an Admin to restrict a submitted shopper and restore access after archival', async () => {
		const admin = { uid: 'synthetic-admin', roles: ['admin'] };
		const registration = getFirestore()
			.collection(COLLECTION_SCHEMA.registrations)
			.doc(shopperUid);
		await registration.set({});
		await expect(
			setShopperAccess(createCallableRequest(disable, admin)),
		).rejects.toMatchObject({ code: 'failed-precondition' });
		await registration.set({
			registrationSubmittedOn: createTimestamp('2026-11-15T15:00:00Z'),
		});
		await expect(
			setShopperAccess(createCallableRequest(disable, admin)),
		).resolves.toEqual({ disabled: true });
		await registration.delete();
		await expect(
			setShopperAccess(
				createCallableRequest(
					{ uid: shopperUid, disabled: false },
					admin,
				),
			),
		).resolves.toEqual({ disabled: false });
		expect((await registration.get()).exists).toBe(false);
	});
});
