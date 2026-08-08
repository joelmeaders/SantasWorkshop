import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';

describe('scheduledReindexRegistrations', () => {
	let adminMock: ReturnType<typeof createBackgroundAdminMock>;

	beforeEach(() => {
		adminMock = createBackgroundAdminMock();
		vi.resetModules();
		vi.doMock('firebase-admin', () => adminMock.module);
	});

	it('indexes submitted registrations while ignoring incomplete records', async () => {
		const handler = (await import('../../../src/fn/scheduledReindexRegistrations'))
			.default;
		adminMock.setCollectionDocs('registrations', [
			{
				id: 'customer-1',
				data: {
					uid: 'customer-1',
					qrcode: 'ABCD1234',
					registrationSubmittedOn: new Date(),
					emailAddress: 'BUDDY@example.com',
					firstName: 'Buddy',
					lastName: 'Elf',
					zipCode: '80205',
				},
			},
			{
				id: 'incomplete',
				data: { uid: 'incomplete', qrcode: 'WXYZ6789' },
			},
		]);

		await expect(handler()).resolves.toBe('Updated index');
		expect(adminMock.transactionSet).toHaveBeenCalledWith(
			adminMock.getDocRef('registrationsearchindex/customer-1'),
			expect.objectContaining({
				code: 'ABCD1234',
				emailAddress: 'buddy@example.com',
				displayFirstName: 'Buddy',
			}),
			{ merge: true },
		);
	});

	it('does not start a transaction when there are no registrations', async () => {
		const handler = (await import('../../../src/fn/scheduledReindexRegistrations'))
			.default;
		adminMock.setCollectionDocs('registrations', []);

		await expect(handler()).resolves.toBe('No registrations');
		expect(adminMock.runTransaction).not.toHaveBeenCalled();
	});
});
