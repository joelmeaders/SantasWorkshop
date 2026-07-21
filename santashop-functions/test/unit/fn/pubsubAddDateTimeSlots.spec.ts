import { beforeEach, describe, expect, it } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import {
	generateUuidMock,
	loadPubsubHandlers,
	parseAsyncMock,
	type PubsubAdminMock,
	writeFileMock,
} from '../helpers/pubsub.unit-helper';

describe('pubsubAddDateTimeSlots handler', () => {
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

	it('does nothing when date time slots already exist', async () => {
		const { pubsubAddDateTimeSlots } =
			await loadPubsubHandlers(backgroundMock);
		backgroundMock.setCollectionDocs('dateTimeSlots', [
			{ id: 'slot-1', data: { enabled: true } },
		]);

		await expect(pubsubAddDateTimeSlots()).resolves.toBeUndefined();
		expect(
			backgroundMock.getCollectionRef('dateTimeSlots').add,
		).not.toHaveBeenCalled();
	});
});
