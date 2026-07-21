import { beforeEach, describe, expect, it } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import {
	generateUuidMock,
	loadPubsubHandlers,
	parseAsyncMock,
	type PubsubAdminMock,
	writeFileMock,
} from '../helpers/pubsub.unit-helper';

describe('pubsubResetCheckInStats handler', () => {
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

	it('returns early when no check-ins need to be reset', async () => {
		const { pubsubResetCheckInStats } =
			await loadPubsubHandlers(backgroundMock);
		backgroundMock.setCollectionDocs('checkins', []);

		const result = await pubsubResetCheckInStats();

		expect(result).toBe('No checkins');
	});
});
