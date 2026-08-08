import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';

describe('queueReminderEmails', () => {
	let adminMock: ReturnType<typeof createBackgroundAdminMock>;

	beforeEach(() => {
		adminMock = createBackgroundAdminMock();
		vi.resetModules();
		vi.doMock('firebase-admin', () => adminMock.module);
	});

	const loadQueue = async () => (await import('../../../src/fn/queueReminderEmails')).default;
	const eligible = (uid = 'customer-1') => ({
		uid,
		qrcode: 'ABCD1234',
		qrCodeStoragePath: `registrations/${uid}/code.png`,
		qrCodeGeneratedOn: new Date('2025-12-01T00:00:00.000Z'),
		registrationSubmittedOn: new Date('2025-12-01T00:00:00.000Z'),
		emailAddress: 'buddy@example.com',
		firstName: 'Buddy',
		dateTimeSlot: {
			dateTime: { toDate: () => new Date('2025-12-10T18:00:00.000Z') },
		},
	});

	it('queues only eligible registrations and marks their queue state atomically', async () => {
		const queue = await loadQueue();
		const current = eligible();
		adminMock.setCollectionDocs('registrations', [
			{ id: 'customer-1', data: current },
			{
				id: 'already-sent',
				data: { ...eligible('already-sent'), reminderEmailSentOn: new Date() },
			},
			{
				id: 'missing-qr',
				data: { ...eligible('missing-qr'), qrCodeGeneratedOn: false },
			},
		]);
		adminMock.setDocSnapshot('registrations/customer-1', current);
		adminMock.setDocSnapshot('tmp_registrationemails/customer-1', {}, false);

		await expect(queue(2025)).resolves.toEqual({ success: 1, failed: 0 });
		expect(adminMock.getDocRef('tmp_registrationemails/customer-1').create).toHaveBeenCalledWith(
			expect.objectContaining({
				code: 'ABCD1234',
				queueSource: 'scheduled-reminder',
				deliveryState: 'queued',
			}),
		);
		expect(adminMock.getDocRef('registrations/customer-1').set).toHaveBeenCalledWith(
			expect.objectContaining({ reminderEmailQueuedOn: expect.any(Date) }),
			{ merge: true },
		);
	});

	it('does not overwrite a registration that became ineligible during the transaction', async () => {
		const queue = await loadQueue();
		adminMock.setCollectionDocs('registrations', [
			{ id: 'customer-1', data: eligible() },
		]);
		adminMock.setDocSnapshot('registrations/customer-1', {
			...eligible(),
			reminderEmailSentOn: new Date(),
		});
		adminMock.setDocSnapshot('tmp_registrationemails/customer-1', {}, false);

		await expect(queue(2025)).resolves.toEqual({ success: 0, failed: 0 });
		expect(adminMock.getDocRef('tmp_registrationemails/customer-1').create).not.toHaveBeenCalled();
	});

	it('records a per-registration failure when queue persistence fails', async () => {
		const queue = await loadQueue();
		const current = eligible();
		adminMock.setCollectionDocs('registrations', [
			{ id: 'customer-1', data: current },
		]);
		adminMock.setDocSnapshot('registrations/customer-1', current);
		adminMock.setDocSnapshot('tmp_registrationemails/customer-1', {}, false);
		adminMock.runTransaction.mockRejectedValue(new Error('write failed'));
		adminMock.getDocRef('registrations/customer-1').set.mockResolvedValue(undefined);

		await expect(queue(2025)).resolves.toEqual({ success: 0, failed: 1 });
		expect(adminMock.getDocRef('registrations/customer-1').set).toHaveBeenCalledWith(
			{ reminderEmailFailedOn: expect.any(Date) },
			{ merge: true },
		);
	});
});
