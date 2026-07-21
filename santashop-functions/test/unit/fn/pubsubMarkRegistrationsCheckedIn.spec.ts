import { beforeEach, describe, expect, it } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import {
	generateUuidMock,
	loadPubsubHandlers,
	parseAsyncMock,
	type PubsubAdminMock,
	writeFileMock,
} from '../helpers/pubsub.unit-helper';

describe('pubsubMarkRegistrationsCheckedIn handler', () => {
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

	it('marks checked-in registrations as having checked in', async () => {
		const { pubsubMarkRegistrationsCheckedIn } =
			await loadPubsubHandlers(backgroundMock);
		backgroundMock.setCollectionDocs('checkins', [
			{
				id: 'checkin-1',
				data: {
					customerId: 'user-1',
				},
			},
		]);

		const result = await pubsubMarkRegistrationsCheckedIn();

		expect(result).toBe('Updated registrations');
		expect(backgroundMock.transactionSet).toHaveBeenCalledWith(
			expect.objectContaining({ path: 'registrations/user-1' }),
			{ hasCheckedIn: true },
			{ merge: true },
		);
	});
});
