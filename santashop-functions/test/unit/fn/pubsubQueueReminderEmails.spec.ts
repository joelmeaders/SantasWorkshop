import { beforeEach, describe, expect, it } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import {
	generateUuidMock,
	loadPubsubHandlers,
	parseAsyncMock,
	type PubsubAdminMock,
	writeFileMock,
} from '../helpers/pubsub.unit-helper';

describe('pubsubQueueReminderEmails handler', () => {
	let backgroundMock: PubsubAdminMock;

	beforeEach(() => {
		backgroundMock = createBackgroundAdminMock();
		backgroundMock.upload.mockResolvedValue(undefined);
		generateUuidMock.mockReturnValue('token-123');
		parseAsyncMock.mockReset();
		writeFileMock.mockImplementation(
			(
				_path: string,
				_output: string,
				callback: (error?: Error | null) => void,
			) => callback(null),
		);
	});

	it('queues reminder emails and marks registrations as queued', async () => {
		const { pubsubQueueReminderEmails } =
			await loadPubsubHandlers(backgroundMock);
		backgroundMock.setCollectionDocs('registrations', [
			{
				id: 'reg-1',
				data: {
					uid: 'reg-1',
					qrcode: 'ABCD2345',
					qrCodeGeneratedOn: new Date('2025-12-01T00:00:00.000Z'),
					firstName: 'Buddy',
					emailAddress: 'buddy.elf@example.com',
					dateTimeSlot: {
						dateTime: {
							toDate: () => new Date('2025-12-10T18:00:00.000Z'),
						},
					},
				},
			},
		]);
		backgroundMock.setDocSnapshot(
			'tmp_registrationemails/reg-1',
			{},
			false,
		);
		backgroundMock
			.getDocRef('tmp_registrationemails/reg-1')
			.create.mockResolvedValue(undefined);
		backgroundMock
			.getDocRef('registrations/reg-1')
			.set.mockResolvedValue(undefined);

		const result = await pubsubQueueReminderEmails();

		expect(result).toEqual({ success: 1, failed: 0 });
		expect(
			backgroundMock.getDocRef('tmp_registrationemails/reg-1').create,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				templateKey: 'event-reminder',
			}),
		);
		expect(
			backgroundMock.getDocRef('registrations/reg-1').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				reminderEmailQueuedOn: expect.any(Date),
				reminderEmailFailedOn: false,
			}),
			{ merge: true },
		);
	});

	it('repairs the queued marker when the queue document already exists', async () => {
		const { pubsubQueueReminderEmails } =
			await loadPubsubHandlers(backgroundMock);
		backgroundMock.setCollectionDocs('registrations', [
			{
				id: 'reg-1',
				data: {
					uid: 'reg-1',
					qrcode: 'ABCD2345',
					qrCodeGeneratedOn: new Date('2025-12-01T00:00:00.000Z'),
					firstName: 'Buddy',
					emailAddress: 'buddy.elf@example.com',
					dateTimeSlot: {
						dateTime: {
							toDate: () => new Date('2025-12-10T18:00:00.000Z'),
						},
					},
				},
			},
		]);
		backgroundMock.setDocSnapshot(
			'tmp_registrationemails/reg-1',
			{
				template: 'dscs-event-reminder',
			},
			true,
		);
		backgroundMock
			.getDocRef('registrations/reg-1')
			.set.mockResolvedValue(undefined);

		const result = await pubsubQueueReminderEmails();

		expect(result).toEqual({ success: 1, failed: 0 });
		expect(
			backgroundMock.getDocRef('tmp_registrationemails/reg-1').create,
		).not.toHaveBeenCalled();
	});

	it('skips registrations whose qr code is not ready yet', async () => {
		const { pubsubQueueReminderEmails } =
			await loadPubsubHandlers(backgroundMock);
		backgroundMock.setCollectionDocs('registrations', [
			{
				id: 'reg-no-qr',
				data: {
					uid: 'reg-no-qr',
					qrcode: 'WAIT1234',
					firstName: 'Buddy',
					emailAddress: 'buddy.elf@example.com',
					dateTimeSlot: {
						dateTime: {
							toDate: () => new Date('2025-12-10T18:00:00.000Z'),
						},
					},
					qrCodeGeneratedOn: false,
				},
			},
		]);

		const result = await pubsubQueueReminderEmails();

		expect(result).toEqual({ success: 0, failed: 0 });
		expect(
			backgroundMock.getDocRef('tmp_registrationemails/reg-no-qr').create,
		).not.toHaveBeenCalled();
	});
});
