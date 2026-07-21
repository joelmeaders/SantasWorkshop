import { beforeEach, describe, expect, it } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import {
	generateUuidMock,
	loadPubsubHandlers,
	parseAsyncMock,
	type PubsubAdminMock,
	writeFileMock,
} from '../helpers/pubsub.unit-helper';

describe('pubsubDeleteUsers handler', () => {
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

	it('deletes enabled users in a single page', async () => {
		const { pubsubDeleteUsers } = await loadPubsubHandlers(backgroundMock);
		backgroundMock.listUsers.mockResolvedValue({
			users: [
				{ uid: 'enabled-user', disabled: false },
				{ uid: 'disabled-user', disabled: true },
			],
			pageToken: undefined,
		});
		backgroundMock.deleteUsers.mockResolvedValue({});

		await expect(pubsubDeleteUsers()).resolves.toBeUndefined();
		expect(backgroundMock.deleteUsers).toHaveBeenCalledWith([
			'enabled-user',
		]);
	});
});
